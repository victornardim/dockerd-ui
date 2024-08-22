class Service {
    #serverSocket;
    #containers;
    #filteredContainers;
    #eventListeners;

    constructor() {
        this.SOCKET_URL = 'ws://localhost';
        this.SOCKET_PORT = 5000;
        this.RECONNECT_TRY_INTERVAL = 10;

        this.#serverSocket = null;

        this.#containers = [];
        this.#filteredContainers = [];

        this.#eventListeners = [];

        this.#registerInternalListeners();
        this.#connectToServerSocket();
    }

    registerListener(event, callback) {
        this.#eventListeners.push({ event, callback });
    }

    getContainers() {
        if (this.#filteredContainers.length) {
            return structuredClone(this.#filteredContainers.length);
        }

        return structuredClone(this.#containers);
    }

    filterContainers(filter) {
        if (!filter) {
            this.#filteredContainers = this.#containers;
        } else {
            this.#filteredContainers = this.#containers.filter(container => container.Name.startsWith(filter));
        }
    }

    startContainer(id) {
        this.#serverSocket.send(JSON.stringify({ command: SocketCommand.START_CONTAINER, id: id }));
    }

    stopContainer(id) {
        this.#serverSocket.send(JSON.stringify({ command: SocketCommand.STOP_CONTAINER, id: id }));
    }

    showContainerLogs(id) {
        this.#serverSocket.send(JSON.stringify({ command: SocketCommand.SHOW_LOGS, id: id }));
    }

    closeContainerLogs() {
        this.#serverSocket.send(JSON.stringify({ command: SocketCommand.CLOSE_LOGS }));
    }

    removeContainer(id) {
        this.#serverSocket.send(JSON.stringify({ command: SocketCommand.REMOVE_CONTAINER, id: id }));
    }

    #registerInternalListeners() {
        this.registerListener(ListenerEvent.UPDATE_CONTAINERS, this.#updateContainers.bind(this));
        this.registerListener(ListenerEvent.UPDATE_CONTAINER, this.#updateContainer.bind(this));
    }

    #emitEvent(event, data) {
        const listerners = this.#eventListeners.filter(listener => listener.event === event);
        if (listerners.length) {
            listerners.forEach(listener => listener.callback(data));
        }
    }

    #connectToServerSocket() {
        const url = `${this.SOCKET_URL}:${this.SOCKET_PORT}`;
        this.#serverSocket = new WebSocket(url);

        this.#emitEvent(ListenerEvent.TRY_CONNECTION, this.#serverSocket.readyState);

        this.#serverSocket.onopen = this.#onOpen.bind(this);
        this.#serverSocket.onmessage = this.#onMessage.bind(this);
        this.#serverSocket.onclose = this.#onClose.bind(this);
    }

    #onOpen() {
        console.info('Connected to WebSocket server');
        this.#emitEvent(ListenerEvent.OPEN_CONNECTION, this.#serverSocket.readyState);
    }

    #onMessage(raw) {
        const message = JSON.parse(raw.data);
        this.#emitEvent(message.type, message.data);
    }

    #onClose() {
        console.info('Connected ended with WebSocket server');
        this.#tryReconnectToSocket();
        this.#emitEvent(ListenerEvent.CLOSE_CONNECTION, this.#serverSocket.readyState);
    }

    #tryReconnectToSocket() {
        reconnectIn = this.RECONNECT_TRY_INTERVAL;
        const intervalId = setInterval(() => {
            this.#emitEvent(ListenerEvent.TRY_RECONNECTION, reconnectIn);
            reconnectIn--;
            if (reconnectIn === 0) {
                connectToSocket();
                clearInterval(intervalId);
            }
        }, 1000);
    }

    #updateContainers(containers) {
        this.#containers = containers;
        this.#filteredContainers = containers;
        this.#sortContainers();
    }

    #sortContainers() {
        this.#filteredContainers = this.#filteredContainers
            .sort((a, b) => a.Name > b.Name ? -1 : 1)
            .sort((a, _b) => a.State === ContainerState.RUNNING ? -1 : 1);
    }

    #updateContainer(container) {
        const foundContainer = this.#filteredContainers.find(c => c.Id === container.Id)
        Object.assign(foundContainer, container);
    }
}