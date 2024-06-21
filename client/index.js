const SOCKET_URL = 'ws://localhost';
const SOCKET_PORT = 5000;
const RECONNECT_TRY_INTERVAL = 10;

let _containers = [];
let currentContainers = [];

let serverSocket = null;
let reconnectIn = 0;

connectToSocket();

function connectToSocket() {
    const url = `${SOCKET_URL}:${SOCKET_PORT}`;

    serverSocket = new WebSocket(url);

    showSocketStatus(serverSocket);

    serverSocket.onopen = function () {
        showSocketStatus(serverSocket);
        console.log('Connected to WebSocket server');
    }

    serverSocket.onclose = function () {
        showSocketStatus(serverSocket);
        console.log('Connected ended with WebSocket server');
        _tryReconnectToSocket();
        document.querySelector('#containers').innerHTML = '';
        document.querySelector('#logs').textContent = '';
        document.querySelector('#logs-wrapper').style.visibility = 'hidden';
    }

    serverSocket.onmessage = function (raw) {
        const message = JSON.parse(raw.data);

        if (message.type === 'CONTAINERS') {
            _containers = message.data;
            currentContainers = _containers;
            showContainers();
        } else if (message.type === 'LOGS') {
            document.querySelector('#logs').innerHTML += `${message.data.replace(/[\x00-\x1F\x7F-\xA0]+/g, '').substr(1)}<br />`;
        } else if (message.type === 'CONTAINER') {
            document.querySelector(`#containers tr[data-container-id="${message.data.Id}"]`).innerHTML = _getContainerView(message.data);
        }
    };
}

function _tryReconnectToSocket() {
    const span = document.querySelector('#reconnecting-in');
    reconnectIn = RECONNECT_TRY_INTERVAL;
    const intervalId = setInterval(() => {
        span.textContent = `Trying to reconnect in ${reconnectIn} seconds...`;
        reconnectIn--;
        if (reconnectIn === 0) {
            connectToSocket();
            span.textContent = '';
            clearInterval(intervalId);
        }
    }, 1000);
}

function showSocketStatus() {
    const span = document.querySelector('#connection-status');
    const status = serverSocket.readyState;
    span.textContent = _getConnectionStatusDescription(status);
    span.className = _getConnectionStatusLabelStyle(status);
}

function _getConnectionStatusDescription(status) {
    switch (status) {
        case WebSocket.CONNECTING:
            return 'CONNECTING';

        case WebSocket.OPEN:
            return 'CONNECTED';

        case WebSocket.CLOSING:
            return 'DISCONNECTING';

        case WebSocket.CLOSED:
            return 'DISCONNECTED';

        default:
            return 'UNKNOWN';
    }
}

function _getConnectionStatusLabelStyle(status) {
    switch (status) {
        case WebSocket.CONNECTING:
            return 'state alert';

        case WebSocket.OPEN:
            return 'state success';

        case WebSocket.CLOSING:
            return 'state alert';

        case WebSocket.CLOSED:
            return 'state warning';

        default:
            return 'state info';
    }
}

function showContainers() {
    document.querySelector('#containers').innerHTML = getContainersView(currentContainers);
}

function getContainersView(containers) {
    return containers
        .map(container => _getContainerView(container))
        .join('');
}

function _getContainerView(container) {
    return `
            <tr data-container-id="${container.Id}">
                <td><input type="checkbox" data-container-id="${container.Id}" name="select-containers" onchange="controlCheckAll()"></td>
                <td class="cell-state">
                    <div class="${_getStateLabelStyle(container.State)}"">
                        ${container.State}
                    </div>
                </td>
                <td class="cell-name">${container.Name ? container.Name : container.Names[0]}</td>
                <td class="cell-image">${container.Image}</td>
                <td class="cell-ports">${_getPorts(container)}</td>
                <td>
                    <button onclick="startContainer('${container.Id}')" ${container.State === 'running' ? 'disabled' : ''} title="Start">
                        <i class="fa-solid fa-play success"></i>
                    </button>
                </td>
                <td>
                    <button onclick="stopContainer('${container.Id}')" ${container.State === 'exited' ? 'disabled' : ''} title="Stop">
                        <i class="fa-solid fa-stop warning"></i>
                    </button>
                </td>
                <td>
                    <button onclick="showLogs('${container.Id}')" ${container.State !== 'running' ? 'disabled' : ''} title="Logs">
                        <i class="fa-solid fa-list"></i>
                    </button>
                </td>
            </tr>
        `;
}

function _getStateLabelStyle(state) {
    switch (state) {
        case ContainerState.CREATED:
            return 'state success';

        case ContainerState.RUNNING:
            return 'state success';

        case ContainerState.EXITED:
            return 'state info';

        case ContainerState.PAUSED:
            return 'state alert';

        case ContainerState.RESTARTING:
            return 'state alert';

        case ContainerState.REMOVING:
            return 'state alert';

        case ContainerState.DEAD:
            return 'state warning';

        default:
            return 'state info';
    }
}

function _getPorts(container) {
    return container.Ports
        .map(port => `<a target="_blank" href="http://127.0.0.1:${port.PublicPort}">${port.PrivatePort}:${port.PublicPort}</a>`)
        .join(' / ');
}

function toggleCheckAll() {
    const element = document.querySelector('#check-all-containers');
    const checked = element.indeterminate ? true : element.checked;
    const elements = Array.from(document.querySelectorAll('input[name=select-containers]'));
    elements.forEach(element => element.checked = checked);
}

function controlCheckAll() {
    const element = document.querySelector('#check-all-containers');
    const elements = Array.from(document.querySelectorAll('input[name=select-containers]'));

    const allChecked = elements.every(el => el.checked);
    const someChecked = elements.some(el => el.checked);

    element.checked = allChecked;
    element.indeterminate = someChecked && !allChecked;
}

function _getSelectedContainers() {
    const checks = document.querySelectorAll('input[name=select-containers]:checked');
    if (!checks.length) {
        alert('No containers selected');
        return;
    }

    return Array.from(checks).map(check => check.getAttribute('data-container-id'));
}

function startSelectedContainers() {
    const containers = _getSelectedContainers();
    if (!containers) return;
    containers.forEach(id => startContainer(id));
}

function stopSelectedContainers() {
    const containers = _getSelectedContainers();
    if (!containers) return;
    containers.forEach(id => stopContainer(id));
}

function startContainer(id) {
    serverSocket.send(JSON.stringify({ command: SocketCommand.START_CONTAINER, id: id }));
    const button = document.querySelector(`tr[data-container-id="${id}"] button[title="Start"]`);
    showSpinner(button);
}

function stopContainer(id) {
    serverSocket.send(JSON.stringify({ command: SocketCommand.STOP_CONTAINER, id: id }));
    const button = document.querySelector(`tr[data-container-id="${id}"] button[title="Stop"]`);
    showSpinner(button);
}

function showLogs(id) {
    document.querySelector('#logs-wrapper').style.visibility = 'visible';
    document.querySelector('#logs').textContent = '';
    serverSocket.send(JSON.stringify({ command: SocketCommand.SHOW_LOGS, id: id }));
}

function closeLogs() {
    document.querySelector('#logs-wrapper').style.visibility = 'hidden';
    serverSocket.send(JSON.stringify({ command: SocketCommand.CLOSE_LOGS }));
}

function clearLogs() {
    document.querySelector('#logs').textContent = '';
}

function showSpinner(button) {
    button.innerHTML = '<i class="fa-solid fa-spinner spin"></i>';
    button.disabled = true;
}

function filterContainers() {
    const filter = document.querySelector('#container-filter').value;
    if (!filter) {
        currentContainers = _containers;
    } else {
        currentContainers = _containers.filter(container => container.Name.startsWith(filter));
    }

    showContainers();
}

const SocketCommand =
    Object.freeze({
        START_CONTAINER: 'start_container',
        STOP_CONTAINER: 'stop_container',
        SHOW_LOGS: 'show_logs',
        CLOSE_LOGS: 'close_logs'
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