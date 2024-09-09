const WebSocket = require('ws');
const Docker = require('dockerode');
const Stream = require('stream');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const WEB_SOCKET_PORT = process.env.WEB_SOCKET_PORT || 5000;
const HTTP_SERVER_PORT = process.env.HTTP_SERVER_PORT || 5001;
const DOCKER_SOCKET_PATH = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';

const docker = Docker({
    socketPath: DOCKER_SOCKET_PATH
});
const httpServer = express();

const socketServer = new WebSocket.Server({
    port: WEB_SOCKET_PORT
}, function() {
    console.info(`WebSocket server start listening on port ${WEB_SOCKET_PORT}...`);
});

let clientSocket = null;
let logStream = null;
let _containers = null;

socketServer.on('connection', function (client) {
    clientSocket = client;

    console.info('Client connected');

    listenToContainerChanges();

    clientSocket.on('message', function (raw) {
        const message = JSON.parse(raw.toString());
        receiveMessage(message);
    });

    clientSocket.on('close', function () {
        console.info('Client closed connection');
        if (logStream) {
            logStream.destroy();
        }
    });
});

function listenToContainerChanges() {
    listContainers();
    const containerBufferStream = new Stream.PassThrough();

    docker.getEvents({ filters: { type: ['container'] } }, function(err, stream) {
        if (err) {
            console.error('Error while listening to container events', err);
            return;
        }

        stream.pipe(containerBufferStream);

        containerBufferStream.on('data', function(chunk) {
            const event = JSON.parse(chunk.toString('utf8'));

            if (shouldUpdateContainer(event.Action)) {
                updateContainer(event.id);
            }

            if (shouldListContainers(event.Action)) {
                listContainers();
            }
        });
    });
}

function shouldUpdateContainer(event) {
    return ['pause', 'rename', 'restart', 'start', 'stop', 'unpause']
        .includes(event)
}

function shouldListContainers(event) {
    return ['create', 'destroy']
        .includes(event);
}

function listContainers() {
    docker.listContainers({ all: true }, function (err, containers) {
        if (err) {
            console.error('Error while trying to list containers', err);
            return;
        }

        const ccontainers = Container.fromList(containers);
        _containers = ccontainers;
        sortContainers();

        clientSocket.send(
            JSON.stringify(
                {
                    type: 'update_containers',
                    data: _containers
                }
            )
        );
        
    });
}

function updateContainer(id) {
    docker.getContainer(id)
        .inspect(function(err, container) {
            if (err) {
                console.error('Error while trying to update container', err);
                return;
            }

            const ccontainer = Container.fromSingle(container)
            const found = _containers.find(c => c.Id = ccontainer.Id);
            Object.assign(found, ccontainer);
            sortContainers();

            clientSocket.send(
                JSON.stringify(
                    {
                        type: 'update_container',
                        data: found
                    }
                )
            );
        });
}

function sortContainers() {
    _containers = _containers
        .sort((a, b) => a.Name > b.Name ? -1 : 1)
        .sort((a, _b) => a.State === ContainerState.RUNNING ? -1 : 1)
        .map((container, idx) => Object.assign(container, {Order: idx}));
}

function receiveMessage(message) {
    switch (message.command) {
        case SocketCommand.START_CONTAINER:
            docker.getContainer(message.id).start();
            break;

        case SocketCommand.STOP_CONTAINER:
            docker.getContainer(message.id).stop();
            break;

        case SocketCommand.SHOW_LOGS:
            showLogs(message.id);
            break;

        case SocketCommand.CLOSE_LOGS:
            logStream.destroy();
            break;

        case SocketCommand.REMOVE_CONTAINER:
            docker.getContainer(message.id).remove();
            break;

        default:
            throw new Error(`Invalid command ${message.command}`);
    }
}

function showLogs(id) {
    if (logStream) {
        logStream.destroy();
    }

    const container = docker.getContainer(id);

    const logBufferStream = new Stream.PassThrough();

    logBufferStream.on('data', function (chunk) {
        clientSocket.send(
            JSON.stringify(
                {
                    type: 'show_logs',
                    data: chunk.toString('utf8')
                }
            )
        );
    });

    logBufferStream.on('close', function() {
        console.info('Logs stream closed');
    });

    container.logs({ follow: true, stdout: true, stderr: true, tail: 20 }, function (err, stream) {
        if (err) {
            console.error(err.message);
            return;
        }

        logStream = stream;

        stream.pipe(logBufferStream);
        console.info('Logs stream opened');

        stream.on('close', function () {
            logBufferStream.destroy();
        });
    });
}

const SocketCommand =
    Object.freeze({
        START_CONTAINER: 'start_container',
        STOP_CONTAINER: 'stop_container',
        SHOW_LOGS: 'show_logs',
        CLOSE_LOGS: 'close_logs',
        REMOVE_CONTAINER: 'remove_container'
    });

const ContainerState =
    Object.freeze({
        CREATED: 'created',
        RESTARTING: 'restarting',
        RUNNING: 'running',
        REMOVING: 'removing',
        PAUSED: 'paused',
        EXITED: 'exited',
        DEAD: 'dead'
    });

class Container {
    static fromSingle(container) {
        return {
            Id: container.Id,
            Name: container.Name.substr(1),
            State: container.State.Status,
            Ports: Port.fromSingle(container),
            Image: container.Config.Image,
            Group: container.Config.Labels['com.docker.compose.project']
        };
    }

    static fromList(containers) {
        return containers.map(container => {
            return {
                Id: container.Id,
                Name: container.Names[0].substr(1),
                State: container.State,
                Ports: Port.fromList(container),
                Image: container.Image,
                Group: container.Labels['com.docker.compose.project']
            };
        });
    }
}

class Port {
    static fromSingle(container) {
        return Object.keys(container.NetworkSettings.Ports)
            .map(key => {
                const port = container.NetworkSettings.Ports[key];
                if (!port) {
                    return;
                }

                return container.NetworkSettings.Ports[key]
                    .filter(port => port.HostIp === '0.0.0.0')
                    .map(port => {
                        return {
                            IP: port.HostIp,
                            PrivatePort: port.HostPort,
                            PublicPort: key.replace(/\D/g, '')
                        }
                    })
            })
            .filter(port => port)
            .flat();
    }

    static fromList(container) {
        return container.Ports
            .filter(port => port.IP === '0.0.0.0')
    }
}

httpServer.use(express.static('./client'));

httpServer.listen(HTTP_SERVER_PORT, function() {
    console.info(`HTTP server start listening on port ${HTTP_SERVER_PORT}...`);
});