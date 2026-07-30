const hub = document.querySelector(".hub-container");
const orbita = document.querySelector(".orbita-hitbox");
const areaInteracao = document.querySelector(".orbita-interacao");
const cards = [...document.querySelectorAll(".carrossel-card")];
const instrucao = document.querySelector(".instrucao-carrossel");

if (!hub || !orbita || !areaInteracao || cards.length === 0) {
    console.error("Não foi possível iniciar o carrossel do ConexãoPro.");
} else {
    class CarrosselEngine {
        constructor() {
            this.angulo = 0;

            // Giro automático lento, da esquerda para a direita.
            this.velocidadePadrao = 0.045;
            this.velocidade = this.velocidadePadrao;

            this.arrastando = false;
            this.ponteiroId = null;
            this.ultimoX = 0;
            this.ultimoTempo = 0;

            this.sensibilidade = 0.22;
            this.atrito = 0.965;
            this.inerciaAtiva = false;

            this.animar = this.animar.bind(this);
            this.iniciarArrasto = this.iniciarArrasto.bind(this);
            this.arrastar = this.arrastar.bind(this);
            this.finalizarArrasto = this.finalizarArrasto.bind(this);

            this.configurarEventos();
            this.renderizar();
            requestAnimationFrame(this.animar);
        }

        configurarEventos() {
            areaInteracao.addEventListener("pointerdown", this.iniciarArrasto);
            window.addEventListener("pointermove", this.arrastar, { passive: false });
            window.addEventListener("pointerup", this.finalizarArrasto);
            window.addEventListener("pointercancel", this.finalizarArrasto);
            window.addEventListener("resize", () => this.renderizar());

            areaInteracao.addEventListener("pointerenter", () => {
                if (!this.arrastando && instrucao) {
                    instrucao.textContent = "Segure e arraste a órbita para girar";
                }
            });

            areaInteracao.addEventListener("pointerleave", () => {
                if (!this.arrastando && instrucao) {
                    instrucao.textContent = "Rotação automática ativa";
                }
            });
        }

        iniciarArrasto(evento) {
            evento.preventDefault();

            this.arrastando = true;
            this.inerciaAtiva = false;
            this.ponteiroId = evento.pointerId;
            this.ultimoX = evento.clientX;
            this.ultimoTempo = performance.now();
            this.velocidade = 0;

            areaInteracao.setPointerCapture(evento.pointerId);
            orbita.classList.add("interagindo");

            if (instrucao) {
                instrucao.textContent = "Arraste para a esquerda ou para a direita";
            }
        }

        arrastar(evento) {
            if (!this.arrastando || evento.pointerId !== this.ponteiroId) {
                return;
            }

            evento.preventDefault();

            const agora = performance.now();
            const deslocamentoX = evento.clientX - this.ultimoX;
            const tempoDecorrido = Math.max(agora - this.ultimoTempo, 1);
            const variacaoAngular = deslocamentoX * this.sensibilidade;

            this.angulo += variacaoAngular;

            const velocidadeInstantanea =
                (variacaoAngular / tempoDecorrido) * 16.67;

            this.velocidade =
                this.velocidade * 0.25 + velocidadeInstantanea * 0.75;

            this.velocidade = Math.max(-2.2, Math.min(2.2, this.velocidade));
            this.ultimoX = evento.clientX;
            this.ultimoTempo = agora;

            this.renderizar();
        }

        finalizarArrasto(evento) {
            if (!this.arrastando || evento.pointerId !== this.ponteiroId) {
                return;
            }

            this.arrastando = false;
            this.inerciaAtiva = Math.abs(this.velocidade) > 0.06;
            this.ponteiroId = null;
            orbita.classList.remove("interagindo");

            if (areaInteracao.hasPointerCapture(evento.pointerId)) {
                areaInteracao.releasePointerCapture(evento.pointerId);
            }

            if (instrucao) {
                instrucao.textContent = this.inerciaAtiva
                    ? "Inércia suave: solte e observe"
                    : "Rotação automática ativa";
            }
        }

        atualizarFisica() {
            if (this.arrastando) {
                return;
            }

            if (this.inerciaAtiva) {
                this.velocidade *= this.atrito;

                if (Math.abs(this.velocidade) < 0.07) {
                    this.inerciaAtiva = false;
                }
            } else {
                this.velocidade +=
                    (this.velocidadePadrao - this.velocidade) * 0.018;
            }

            this.angulo += this.velocidade;
        }

        renderizar() {
            const largura = hub.clientWidth;
            const altura = hub.clientHeight;

            const raioX = largura * 0.43;
            const raioY = altura * 0.22;
            const espacamento = 360 / cards.length;

            let maiorProfundidade = -Infinity;
            let cardFrontal = null;

            cards.forEach((card, indice) => {
                const anguloCard = this.angulo + espacamento * indice;
                const radianos = anguloCard * (Math.PI / 180);

                const x = Math.sin(radianos) * raioX;
                const profundidade = Math.cos(radianos);

                // Frente abaixo e fundo acima: disco inclinado para o observador.
                const y = profundidade * raioY;
                const nivel = (profundidade + 1) / 2;

                const escala = 0.43 + nivel * 0.78;
                const opacidade = 0.24 + nivel * 0.76;
                const inclinacaoLateral = -Math.sin(radianos) * 10;

                card.style.transform = `
                    translate(-50%, -50%)
                    translate3d(${x}px, ${y}px, 0)
                    rotateY(${inclinacaoLateral}deg)
                    scale(${escala})
                `;

                card.style.opacity = opacidade;
                card.style.zIndex = 20 + Math.round(nivel * 80);
                card.style.filter = `
                    brightness(${0.52 + nivel * 0.55})
                    blur(${(1 - nivel) * 0.6}px)
                `;

                if (profundidade > maiorProfundidade) {
                    maiorProfundidade = profundidade;
                    cardFrontal = card;
                }
            });

            cards.forEach((card) => {
                card.classList.toggle("ativo", card === cardFrontal);
            });
        }

        animar() {
            this.atualizarFisica();
            this.renderizar();
            requestAnimationFrame(this.animar);
        }
    }

    new CarrosselEngine();
}

// Navegação dos cartões: somente o cartão em destaque responde ao clique.
const destinos = {
    login: "login.html",
    cadastro: "cadastro.html",
    cursos: "interno.html",
    senai: "#",
    desenvolvedores: "#"
};

cards.forEach((card) => {
    card.style.pointerEvents = "auto";

    card.addEventListener("click", () => {
        if (!card.classList.contains("ativo")) return;

        const painel = card.dataset.painel;
        const destino = destinos[painel];

        if (destino && destino !== "#") {
            window.location.href = destino;
            return;
        }

        if (instrucao) {
            instrucao.textContent = "Este conteúdo será adicionado na próxima etapa";
        }
    });
});
