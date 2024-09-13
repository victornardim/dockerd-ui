class Controller {
    #service;
    #view;

    constructor() {
        this.#service = new Service();
        this.#view = new View();

        this.#registerEvents();
        this.#registerListeners();
    }

    startSelectedContainers() {
        const containers = this.#getSelectedContainers();
        if (!containers) return;
        containers.forEach(id => this.#service.startContainer(id));
    }
    
    stopSelectedContainers() {
        const containers = this.#getSelectedContainers();
        if (!containers) return;
        containers.forEach(id => this.#service.stopContainer(id));
    }
    
    removeSelectedContainers() {
        const containers = this.#getSelectedContainers();
        if (!containers) return;
        if (confirm(`${containers.length} container(s) will be deleted permanently, are you sure?`)) {
            containers.forEach(id => this.#service.removeContainer(id));
        }
    }
    
    stopRunningContainers() {
        const containers = this.#service.getContainers().filter(container => container.State === ContainerState.RUNNING);
        if (!containers.length) {
            alert('No running containers');
        }
        containers.forEach(container => this.#service.stopContainer(container.Id));
    }
    
    startContainer(id) {
        this.#service.startContainer(id);
        const button = $(`tr[data-container-id="${id}"] button[title="Start"]`);
        this.showSpinner(button);
    }
    
    stopContainer(id) {
        this.#service.stopContainer(id);
        const button = $(`tr[data-container-id="${id}"] button[title="Stop"]`);
        this.showSpinner(button);
    }
    
    showContainerLogs(id) {
        $('#logs-wrapper').style.visibility = 'visible';
        $('#logs').textContent = '';
        this.#service.showContainerLogs(id);
    }
    
    removeContainer(id, name) {
        if (confirm(`Container ${name} will be deleted permanently, are you sure?`)) {
            this.#service.removeContainer(id);
        }
    }
    
    closeLogs() {
        $('#logs-wrapper').style.visibility = 'hidden';
        this.#service.closeContainerLogs();
    }
    
    clearLogs() {
        $('#logs').textContent = '';
    }
    
    filterContainersByName() {
        const filter = $('#container-filter').value;
        this.#service.filterContainersByName(filter);
        this.#showContainers(this.#service.getContainers());
    }

    showSpinner(button) {
        button.innerHTML = this.#view.getSpinner();
        button.disabled = true;
    }

    toggleCheckAll() {
        const element = $('#check-all-containers');
        const checked = element.indeterminate ? true : element.checked;
        const elements = Array.from(document.querySelectorAll('input[name=select-containers]'));
        elements.forEach(element => element.checked = checked);
    }
    
    controlCheckAll() {
        const element = $('#check-all-containers');
        const elements = Array.from(document.querySelectorAll('input[name=select-containers]'));
    
        const allChecked = elements.every(el => el.checked);
        const someChecked = elements.some(el => el.checked);
    
        element.checked = allChecked;
        element.indeterminate = someChecked && !allChecked;
    }

    #registerEvents() {
        document.querySelector('#btn-start-selected')
        .addEventListener('click', this.startSelectedContainers.bind(this));

        document.querySelector('#btn-stop-selected')
            .addEventListener('click', this.stopSelectedContainers.bind(this));

        document.querySelector('#btn-stop-running')
            .addEventListener('click', this.stopRunningContainers.bind(this));
        
        document.querySelector('#btn-remove-selected')
            .addEventListener('click', this.removeSelectedContainers.bind(this));

        document.querySelector('#logs-wrapper #close')
            .addEventListener('click', this.closeLogs.bind(this));

        document.querySelector('#logs-wrapper #clear')
            .addEventListener('click', this.clearLogs.bind(this));

        document.querySelector('#check-all-containers')
            .addEventListener('change', this.toggleCheckAll.bind(this));

        document.querySelector('#container-filter')
            .addEventListener('keyup', this.filterContainersByName.bind(this));
    }

    #registerListeners() {
        this.#service.registerListener(ListenerEvent.TRY_CONNECTION, this.#showSocketStatus.bind(this));
        this.#service.registerListener(ListenerEvent.TRY_RECONNECTION, this.#onTryReconnection.bind(this));
        this.#service.registerListener(ListenerEvent.OPEN_CONNECTION, this.#showSocketStatus.bind(this));
        this.#service.registerListener(ListenerEvent.CLOSE_CONNECTION, this.#onCloseConnection.bind(this));
        this.#service.registerListener(ListenerEvent.UPDATE_CONTAINERS, this.#onUpdateContainers.bind(this));
        this.#service.registerListener(ListenerEvent.UPDATE_CONTAINER, this.#onUpdateContainer.bind(this));
        this.#service.registerListener(ListenerEvent.SHOW_LOGS, this.#onShowLogs.bind(this));
    }

    #showSocketStatus(state) {
        const span = $('#connection-status');
        span.textContent = this.#getConnectionStatusDescription(state);
        span.className = this.#getConnectionStatusLabelStyle(state);
    }

    #getConnectionStatusDescription(status) {
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

    #getConnectionStatusLabelStyle(status) {
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

    #onTryReconnection(reconnectIn) {
        $('#container-groups').innerHTML = '';

        const span = $('#reconnecting-in');
        span.textContent = `Trying to reconnect in ${reconnectIn} seconds...`;
        if (reconnectIn === 0) {
            span.textContent = '';
        }
    }

    #onCloseConnection(state) {
        $('#containers').innerHTML = '';
        $('#logs').textContent = '';
        $('#logs-wrapper').style.visibility = 'hidden';
        this.#showSocketStatus(state);
    }

    #onUpdateContainers(containers) {
        this.#showContainers(containers);
        this.#addGroupFilterButtons(containers);
    }
    
    #showContainers(containers) {
        $('#containers').innerHTML = '';
        $('#containers').append(...this.#getContainersComponent(containers));
    }

    #getContainersComponent(containers) {
        const fragment = document.createDocumentFragment();
        containers.forEach((container) => {
            fragment.appendChild(this.#getContainerComponent(container));
        });

        return fragment.childNodes;
    }

    #getContainerComponent(container) {
        const view = this.#view.getContainer(container);

        const check = view.querySelector('input[name=select-containers]');
        check.onchange = this.controlCheckAll;

        const btnStart = view.querySelector('#btn-start-container');
        btnStart.onclick = this.startContainer.bind(this, container.Id);

        const btnStop = view.querySelector('#btn-stop-container');
        btnStop.onclick = this.stopContainer.bind(this, container.Id);

        const btnShowLogs = view.querySelector('#btn-show-logs');
        btnShowLogs.onclick = this.showContainerLogs.bind(this, container.Id);

        const btnRemove = view.querySelector('#btn-remove-container');
        btnRemove.onclick = this.removeContainer.bind(this, container.Id, container.Name);

        return view;
    }

    #addGroupFilterButtons(containers) {
        $('#container-groups').innerHTML = '';
        const groups = new Set(containers.map(container => container.Group).filter(group => !!group));
        groups.forEach(group => {
            const btn = document.createElement('button');
            btn.innerText = group;
            btn.setAttribute('active', false);
            btn.classList.add('container-group-button');
            btn.onclick = this.#filterContainersByGroup.bind(this, group, btn);

            $('#container-groups').appendChild(btn);
        });
    }

    #filterContainersByGroup(group, button) {
        const newState = button.getAttribute('active') !== 'true';
        if (newState) {
            $('.container-group-button[active="true"]')?.setAttribute('active', false);
        }
        button.setAttribute('active', newState);
        this.#service.filterContainersByGroup(group, newState);
        this.#showContainers(this.#service.getContainers());
    }

    #onUpdateContainer(container) {
        this.#updateContainersComponent(container);
    }

    #updateContainersComponent(container) {
        if (container.State === ContainerState.RUNNING) {
            this.#updateContainersComponentSorted(container);
            return;
        }

        const row = $(`#containers tr[data-container-id="${container.Id}"]`);
        row.replaceWith(this.#getContainerComponent(container));
    }

    #updateContainersComponentSorted(container) {
        const index = $(`#containers tr[data-container-id="${container.Id}"]`).rowIndex - 1;
        $('#containers').deleteRow(index);
        const row = $('#containers').insertRow(0);
        row.replaceWith(this.#getContainerComponent(container));
        row.setAttribute('data-container-id', container.Id);
    }

    #onShowLogs(rawLogs) {
        const logs = rawLogs.removeANSICharacters().removeNonPrintableCharacters();
        $('#logs').innerHTML += `${logs.substr(1)}<br />`;
    }

    #getSelectedContainers() {
        const checks = document.querySelectorAll('input[name=select-containers]:checked');
        if (!checks.length) {
            alert('No containers selected');
            return;
        }
    
        return Array.from(checks).map(check => check.getAttribute('data-container-id'));
    }
}
