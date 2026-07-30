const CHAVE_USUARIOS = "@conexaopro:usuarios";
const CHAVE_SESSAO = "@conexaopro:sessao";

function lerUsuarios() {
    try { return JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || []; }
    catch { return []; }
}

function mostrarMensagem(elemento, texto, sucesso = false) {
    elemento.textContent = texto;
    elemento.classList.toggle("sucesso", sucesso);
}

document.querySelectorAll(".mostrar-senha").forEach((botao) => {
    botao.addEventListener("click", () => {
        const input = botao.parentElement.querySelector("input");
        const oculto = input.type === "password";
        input.type = oculto ? "text" : "password";
        botao.innerHTML = oculto ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
});

const formCadastro = document.querySelector("#form-cadastro");
if (formCadastro) {
    formCadastro.addEventListener("submit", (evento) => {
        evento.preventDefault();
        const dados = Object.fromEntries(new FormData(formCadastro));
        const mensagem = document.querySelector("#mensagem");

        if (!dados.nome.trim() || !dados.matricula.trim() || !dados.curso || !dados.senha || !dados.confirmarSenha) {
            mostrarMensagem(mensagem, "Preencha todos os campos."); return;
        }
        if (dados.senha.length < 4) { mostrarMensagem(mensagem, "A senha precisa ter pelo menos 4 caracteres."); return; }
        if (dados.senha !== dados.confirmarSenha) { mostrarMensagem(mensagem, "As senhas não coincidem."); return; }

        const usuarios = lerUsuarios();
        if (usuarios.some((u) => u.matricula === dados.matricula.trim())) {
            mostrarMensagem(mensagem, "Esta matrícula já está cadastrada."); return;
        }

        usuarios.push({ nome: dados.nome.trim(), matricula: dados.matricula.trim(), curso: dados.curso, senha: dados.senha });
        localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
        mostrarMensagem(mensagem, "Cadastro criado! Redirecionando para o login...", true);
        setTimeout(() => window.location.href = "login.html", 900);
    });
}

const formLogin = document.querySelector("#form-login");
if (formLogin) {
    formLogin.addEventListener("submit", (evento) => {
        evento.preventDefault();
        const dados = Object.fromEntries(new FormData(formLogin));
        const mensagem = document.querySelector("#mensagem");
        const usuario = lerUsuarios().find((u) => u.matricula === dados.matricula.trim() && u.senha === dados.senha);

        if (!usuario) { mostrarMensagem(mensagem, "Matrícula ou senha inválida. Faça o cadastro primeiro."); return; }
        localStorage.setItem(CHAVE_SESSAO, JSON.stringify({ nome: usuario.nome, matricula: usuario.matricula, curso: usuario.curso }));
        mostrarMensagem(mensagem, "Login realizado! Abrindo sua comunidade...", true);
        setTimeout(() => window.location.href = "interno.html", 600);
    });
}
