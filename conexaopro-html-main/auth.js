// ===== AUTENTICAÇÃO VIA API =====

function mostrarMensagem(elemento, texto, sucesso = false) {
    elemento.textContent = texto;
    elemento.classList.remove("sucesso", "erro");
    elemento.classList.toggle("sucesso", sucesso);
    elemento.classList.toggle("erro", !sucesso);
}

// Mostrar/ocultar senha
document.querySelectorAll(".mostrar-senha").forEach((botao) => {
    botao.addEventListener("click", () => {
        const input = botao.parentElement.querySelector("input");
        const oculto = input.type === "password";
        input.type = oculto ? "text" : "password";
        botao.innerHTML = oculto ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
});

// ===== CADASTRO =====
const formCadastro = document.querySelector("#form-cadastro");
if (formCadastro) {
    formCadastro.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const dados = Object.fromEntries(new FormData(formCadastro));
        const mensagem = document.querySelector("#mensagem");
        const botao = formCadastro.querySelector("button[type='submit']");

        if (!dados.nome.trim() || !dados.matricula.trim() || !dados.curso || !dados.senha || !dados.confirmarSenha) {
            mostrarMensagem(mensagem, "Preencha todos os campos.");
            return;
        }
        if (dados.senha.length < 4) {
            mostrarMensagem(mensagem, "A senha precisa ter pelo menos 4 caracteres.");
            return;
        }
        if (dados.senha !== dados.confirmarSenha) {
            mostrarMensagem(mensagem, "As senhas não coincidem.");
            return;
        }

        botao.disabled = true;
        botao.textContent = "Cadastrando...";

        try {
            const resultado = await apiCadastro(
                dados.nome.trim(),
                dados.matricula.trim(),
                dados.curso,
                dados.senha
            );
            mostrarMensagem(mensagem, resultado.mensagem || "Cadastro criado! Redirecionando...", true);
            setTimeout(() => window.location.href = "login.html", 900);
        } catch (erro) {
            mostrarMensagem(mensagem, erro.message || "Erro ao cadastrar.");
        } finally {
            botao.disabled = false;
            botao.textContent = "Criar minha conta";
        }
    });
}

// ===== LOGIN =====
const formLogin = document.querySelector("#form-login");
if (formLogin) {
    formLogin.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const dados = Object.fromEntries(new FormData(formLogin));
        const mensagem = document.querySelector("#mensagem");
        const botao = formLogin.querySelector("button[type='submit']");

        if (!dados.matricula?.trim() || !dados.senha) {
            mostrarMensagem(mensagem, "Preencha todos os campos.");
            return;
        }

        botao.disabled = true;
        botao.textContent = "Entrando...";

        try {
            const resultado = await apiLogin(dados.matricula.trim(), dados.senha);
            mostrarMensagem(mensagem, resultado.mensagem || "Login realizado! Abrindo sua comunidade...", true);
            setTimeout(() => window.location.href = "interno.html", 600);
        } catch (erro) {
            mostrarMensagem(mensagem, erro.message || "Erro ao fazer login.");
        } finally {
            botao.disabled = false;
            botao.textContent = "Entrar";
        }
    });
}

// ===== VERIFICAR SESSÃO EM PÁGINAS INTERNAS =====
(async function verificarSessao() {
    // Páginas que não precisam de autenticação
    const paginasPublicas = ["index.html", "login.html", "cadastro.html", ""];
    const paginaAtual = window.location.pathname.split("/").pop() || "index.html";

    if (paginasPublicas.includes(paginaAtual)) {
        return;
    }

    const sessao = getSessao();
    if (!sessao || !getToken()) {
        window.location.replace("login.html");
        return;
    }

    try {
        await apiValidarSessao();
    } catch {
        window.location.replace("login.html");
    }
})();
