// ===== API HELPER =====
// Conexão com o backend Express

const API_BASE = "http://localhost:3000/api";

function getToken() {
    return localStorage.getItem("@conexaopro:token");
}

function setToken(token) {
    if (token) {
        localStorage.setItem("@conexaopro:token", token);
    } else {
        localStorage.removeItem("@conexaopro:token");
    }
}

function getSessao() {
    try {
        return JSON.parse(localStorage.getItem("@conexaopro:sessao"));
    } catch {
        return null;
    }
}

function setSessao(usuario) {
    if (usuario) {
        localStorage.setItem("@conexaopro:sessao", JSON.stringify(usuario));
    } else {
        localStorage.removeItem("@conexaopro:sessao");
    }
}

async function apiFetch(caminho, opcoes = {}) {
    const token = getToken();
    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opcoes.headers,
    };

    const resposta = await fetch(`${API_BASE}${caminho}`, {
        ...opcoes,
        headers,
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(dados.erro || "Erro na requisição");
    }

    return dados;
}

// ===== AUTH =====

async function apiCadastro(nome, matricula, curso, senha) {
    const dados = await apiFetch("/auth/cadastro", {
        method: "POST",
        body: JSON.stringify({ nome, matricula, curso, senha }),
    });
    if (dados.token) {
        setToken(dados.token);
        setSessao(dados.usuario);
    }
    return dados;
}

async function apiLogin(matricula, senha) {
    const dados = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ matricula, senha }),
    });
    if (dados.token) {
        setToken(dados.token);
        setSessao(dados.usuario);
    }
    return dados;
}

async function apiValidarSessao() {
    try {
        const dados = await apiFetch("/auth/sessao");
        if (dados.valido) {
            setSessao(dados.usuario);
            return dados.usuario;
        }
        return null;
    } catch {
        setSessao(null);
        setToken(null);
        return null;
    }
}

async function apiSair() {
    try {
        await apiFetch("/auth/sair", { method: "DELETE" });
    } catch {
        // Ignorar erro ao sair
    }
    setToken(null);
    setSessao(null);
}

// ===== USUÁRIOS =====

async function apiListarUsuarios() {
    return apiFetch("/usuarios");
}

async function apiBuscarUsuario(id) {
    return apiFetch(`/usuarios/${id}`);
}

async function apiAtualizarPerfil(dados) {
    return apiFetch("/usuarios/perfil", {
        method: "PUT",
        body: JSON.stringify(dados),
    });
}

// ===== CONEXÕES =====

async function apiSolicitarConexao(destinatarioId) {
    return apiFetch("/conexoes/solicitar", {
        method: "POST",
        body: JSON.stringify({ destinatario_id: destinatarioId }),
    });
}

async function apiResponderConexao(id, acao) {
    return apiFetch(`/conexoes/${id}/${acao}`, {
        method: "PUT",
    });
}

async function apiListarConexoes() {
    return apiFetch("/conexoes");
}

async function apiStatusConexao(usuarioId) {
    return apiFetch(`/conexoes/status/${usuarioId}`);
}

async function apiRemoverConexao(id) {
    return apiFetch(`/conexoes/${id}`, {
        method: "DELETE",
    });
}

// ===== MENSAGENS =====

async function apiEnviarMensagem(destinatarioId, mensagem) {
    return apiFetch("/mensagens/enviar", {
        method: "POST",
        body: JSON.stringify({ destinatario_id: destinatarioId, mensagem }),
    });
}

async function apiListarConversas() {
    return apiFetch("/mensagens/conversas");
}

async function apiBuscarMensagens(usuarioId) {
    return apiFetch(`/mensagens/${usuarioId}`);
}
