class View {
    getContainer(container) {
        const component = `
                <td><input type="checkbox" data-container-id="${container.Id}" name="select-containers"></td>
                <td class="cell-state">
                    <div class="${this.#getStateLabelStyle(container.State)}"">
                        ${container.State}
                    </div>
                </td>
                <td class="cell-name">${container.Name ? container.Name : container.Names[0]}</td>
                <td class="cell-image">${container.Image}</td>
                <td class="cell-ports">${this.#getPortsComponent(container)}</td>
                <td>
                    <button id="btn-start-container" ${container.State === 'running' ? 'disabled' : ''} title="Start">
                        <i class="fa-solid fa-play success"></i>
                    </button>
                </td>
                <td>
                    <button id="btn-stop-container" ${container.State === 'exited' ? 'disabled' : ''} title="Stop">
                        <i class="fa-solid fa-stop warning"></i>
                    </button>
                </td>
                <td>
                    <button id="btn-show-logs" title="Logs">
                        <i class="fa-solid fa-list"></i>
                    </button>
                </td>
                <td>
                    <button id="btn-remove-container" title="Remove">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;

        const tr = document.createElement('tr');
        tr.setAttribute('data-container-id', container.Id);
        tr.innerHTML = component;

        return tr;
    }

    getSpinner() {
        return '<i class="fa-solid fa-spinner spin"></i>';
    }

    #getStateLabelStyle(state) {
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

    #getPortsComponent(container) {
        return container.Ports
            .map(port => `<a target="_blank" href="http://127.0.0.1:${port.PublicPort}">${port.PrivatePort}:${port.PublicPort}</a>`)
            .join(' / ');
    }
}