const ListenerEvent =
    Object.freeze({
        DOCKER_STATUS: 'docker_status',
        TRY_CONNECTION: 'try_connection',
        TRY_RECONNECTION: 'try_reconnection',
        OPEN_CONNECTION: 'open_connection',
        CLOSE_CONNECTION: 'close_connection',
        UPDATE_CONTAINERS: 'update_containers',
        UPDATE_CONTAINER: 'update_container',
        SHOW_LOGS: 'show_logs'
    });