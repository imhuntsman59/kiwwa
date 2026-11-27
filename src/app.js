function toggle_sidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
}
function checkMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
    } else {
        sidebar.classList.remove('collapsed');
    }
}

function toggle_theme() {
    const themeBtn = document.getElementById('themeButton');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (themeBtn) themeBtn.textContent = '☀';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (themeBtn) themeBtn.textContent = '☾';
    }
}

function toggle_servers() {
    const dialog = document.getElementById('serversDialog');
    if (dialog) dialog.showModal();
}
function toggle_info() {
    const dialog = document.getElementById('infoDialog');
    if (dialog) dialog.showModal();
}
function close_dialogs() {
    document.querySelectorAll('.modalDialog[open]').forEach(d => d.close());
}

function sync_servers() {
    localStorage.setItem(STORAGE_SERVERS, JSON.stringify(servers));
    render_servers_list();
    render_server_select();
}
function render_servers_list() {
    const list = document.getElementById('serversList');
    if (!list) return;
    if (servers.length === 0) {
        list.innerHTML = '<p style="color: var(--textMuted); font-size: 14px; margin: 0;">no servers found</p>';
        return;
    }
    list.innerHTML = servers.map(srv => `
        <div class="serverItem">
            <div>
                <strong>${srv.name}</strong>
                <div class="serverUrl">${srv.url}</div>
            </div>
            <button square type="button" onclick="delete_server('${srv.id}')" title="delete">🗑</button>
        </div>
    `).join('');
}
function render_server_select() {
    const select = document.getElementById('serverSelect');
    if (!select) return;
    const currentVal = select.value;
    if (servers.length > 0) {
        select.innerHTML = servers.map(srv => 
        `<option value="${srv.id}">${srv.name}</option>`
        ).join('');
    } else {
        select.innerHTML = `<option value="nothing">no servers found</option>`;
    }
    if (servers.some(s => s.id === currentVal)) {
        select.value = currentVal;
    }
}
function save_server(event) {
    event.preventDefault();
    const name = document.getElementById('srvName').value.trim();
    const url = document.getElementById('srvUrl').value.trim().replace(/\/+$/, '');
    const key = document.getElementById('srvKey').value.trim();
    const paramsRaw = document.getElementById('srvParams').value.trim();
    if (paramsRaw) {
        try {
            JSON.parse(paramsRaw);
        } catch (e) {
            alert('JSON error!');
            return;
        }
    }
    const newServer = {id: 'srv_' + Date.now(),name,url,key,params: paramsRaw || '{}'};
    servers.push(newServer);
    sync_servers();
    const select = document.getElementById('serverSelect');
    if (select) select.value = newServer.id;
    event.target.reset();
}
function delete_server(id) {
    servers = servers.filter(s => s.id !== id);
    sync_servers();
}
async function load_models() {
    const serverSelect = document.getElementById('serverSelect');
    const modelSelect = document.getElementById('modelSelect');
    if (!serverSelect || !modelSelect) return;
    let serverId = serverSelect.value;
    if (!serverId && servers.length > 0) {
        serverId = servers[0].id;
        serverSelect.value = serverId;
    }
    const server = servers.find(s => s.id === serverId);
    if (!server) {
        modelSelect.innerHTML = '<option value="nothing">no servers found</option>';
        return;
    }
    localStorage.setItem(STORAGE_ACTIVE_SERVER, serverId);
    modelSelect.innerHTML = '<option value="nothing">loading models...</option>';
    modelSelect.disabled = true;
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (server.key) {
            headers['Authorization'] = `Bearer ${server.key}`;
        }
        const response = await fetch(`${server.url}/models`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
        const modelsList = rawList.filter(m => !m.model_type || m.model_type === 'chat');
        if (modelsList.length === 0) {
            modelSelect.innerHTML = '<option value="nothing">no models found</option>';
            return;
        }
        modelsList.sort((a, b) => a.id.localeCompare(b.id));
        modelSelect.innerHTML = modelsList.map(m => 
            `<option value="${m.id}">${m.id}</option>`
        ).join('');
        const savedModel = localStorage.getItem(STORAGE_ACTIVE_MODEL);
        if (savedModel && modelsList.some(m => m.id === savedModel)) {
            modelSelect.value = savedModel;
        } else {
            localStorage.setItem(STORAGE_ACTIVE_MODEL, modelSelect.value);
        }

    } catch (error) {
        modelSelect.innerHTML = `<option value="">error: ${error.message}</option>`;
    } finally {
        modelSelect.disabled = false;
    }
}

function sync_chats() {
    localStorage.setItem(STORAGE_CHATS, JSON.stringify(chats));
    localStorage.setItem(STORAGE_ACTIVE_CHAT, activeChatId || '');
    render_chat_list();
}
function new_chat() {
    const newChat = {
        id: 'chat_' + Date.now(),
        title: 'new chat ' + (chats.length + 1),
        messages: []
    };
    chats.unshift(newChat); 
    activeChatId = newChat.id;
    sync_chats();
    render_messages();
}
function select_chat(id) {
    activeChatId = id;
    sync_chats();
    render_messages();
}
function start_rename_chat(event, id) {
    event.stopPropagation();
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    const itemEl = event.target.closest('.chatItem');
    const titleEl = itemEl.querySelector('.chatTitle');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'chatRenameInput';
    input.value = chat.title;
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    const finishRename = () => {
        const newTitle = input.value.trim();
        if (newTitle) {
            chat.title = newTitle;
        }
        sync_chats();
    };
    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            sync_chats(); 
        }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
}
function delete_chat(event, id) {
    event.stopPropagation();
    chats = chats.filter(c => c.id !== id);
    if (activeChatId === id) {
        activeChatId = chats.length > 0 ? chats[0].id : null;
    }
    sync_chats();
    render_messages();
}
function render_chat_list() {
    const list = document.getElementById('chatList');
    if (!list) return;
    if (chats.length === 0) {
        list.innerHTML = '<p style="color: var(textMuted); font-size: 14px; margin: 0;">no chats yet</p>';
        return;
    }
    list.innerHTML = chats.map(chat => `
        <div class="chatItem ${chat.id === activeChatId ? 'active' : ''}" onclick="select_chat('${chat.id}')">
            <span class="chatTitle">${chat.title}</span>
            <div class="chatActions">
                <button type="button" onclick="start_rename_chat(event, '${chat.id}')" title="rename">✎</button>
                <button type="button" class="deleteBtn" onclick="delete_chat(event, '${chat.id}')" title="delete">🗑</button>
            </div>
        </div>
    `).join('');
}
function render_messages() {
    const box = document.getElementById('messages');
    if (!box) return;
    const chat = chats.find(c => c.id === activeChatId);
    box.innerHTML = '';
    if (!chat) return;
    box.innerHTML = chat.messages.map(m => {
        if (m.role === 'user') return `<div class="message user">${m.content}</div>`;
        const safeMath = m.content.replace(/\\([\[\]\(\)])/g, '\\\\$1');
        return `<div class="message assistant">${DOMPurify.sanitize(marked.parse(safeMath))}</div>`;
    }).join('');
    if (window.renderMathInElement) {
        renderMathInElement(box, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false }
            ],
            throwOnError: false
        });
    }
    box.scrollTop = box.scrollHeight;
}

async function send_message() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    const server = servers.find(s => s.id === document.getElementById('serverSelect')?.value);
    const model = document.getElementById('modelSelect')?.value;
    if (!text || !server || !model || model === 'nothing') return;
    if (!activeChatId) new_chat();
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat.messages.length) chat.title = text.slice(0, 28);
    chat.messages.push({ role: 'user', content: text }, { role: 'assistant', content: '...' });
    input.value = '';
    sync_chats();
    render_messages();
    try {
        const res = await fetch(`${server.url}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(server.key && { Authorization: `Bearer ${server.key}` }) },
            body: JSON.stringify({ ...JSON.parse(server.params || '{}'), model, messages: chat.messages.slice(0, -1) })
        });
        const data = await res.json();
        chat.messages.at(-1).content = data.choices?.[0]?.message?.content || 'emty answer';
    } catch (e) {
        chat.messages.at(-1).content = `error: ${e.message}`;
    }
    sync_chats();
    render_messages();
}


// INIT
const STORAGE_SERVERS = 'ai_chat_servers';
const STORAGE_ACTIVE_SERVER = 'ai_chat_active_server';
const STORAGE_ACTIVE_MODEL = 'ai_chat_active_model';
const STORAGE_CHATS = 'ai_chat_list';
const STORAGE_ACTIVE_CHAT = 'ai_active_chat_id';
const savedTheme = localStorage.getItem('theme');

let servers = JSON.parse(localStorage.getItem(STORAGE_SERVERS)) || [];
let chats = JSON.parse(localStorage.getItem(STORAGE_CHATS)) || [];
let activeChatId = localStorage.getItem(STORAGE_ACTIVE_CHAT) || null;

if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeBtn) themeBtn.textContent = '☾';
}
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'DIALOG') {
        e.target.close();
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    const modelSelect = document.getElementById('modelSelect');
    const savedServerId = localStorage.getItem(STORAGE_ACTIVE_SERVER);
    if (savedServerId && servers.some(s => s.id === savedServerId)) {
        serverSelect.value = savedServerId;
    }
    if (serverSelect) {
        serverSelect.addEventListener('change', load_models);
    }
    if (modelSelect) {
        modelSelect.addEventListener('change', () => {
            localStorage.setItem(STORAGE_ACTIVE_MODEL, modelSelect.value);
        });
    }
    if (chats.length === 0) {
        new_chat(); 
    } else {
        if (!activeChatId || !chats.some(c => c.id === activeChatId)) {
            activeChatId = chats[0].id;
        }
        render_chat_list();
    }
    document.getElementById('chatInput').onkeydown = e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send_message(); }
    };
    render_servers_list();
    render_server_select();
    checkMobileSidebar();
    render_chat_list();
    load_models();
    render_messages();
});



