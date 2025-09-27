// --- LIKE AUTH MODAL LOGIC ---
let likeAuthModalTimeout;
function showLikeAuthModal(msg) {
  const modal = document.getElementById("like-auth-modal");
  const modalInner = document.getElementById("like-auth-modal-inner");
  const modalMsg = document.getElementById("like-auth-modal-msg");
  if (modal && modalMsg && modalInner) {
    modalMsg.textContent =
      msg || "Debes iniciar sesión para agregar productos a tus favoritos.";
    // Responsive position
    if (window.innerWidth < 768) {
      modal.classList.remove("items-end", "justify-start");
      modal.classList.add("items-end", "justify-center");
      modal.style.bottom = "70px";
      modal.style.top = "";
      modal.style.left = "0";
      modal.style.right = "0";
    } else {
      modal.classList.remove("items-end", "justify-center");
      modal.classList.add("items-end", "justify-start");
      modal.style.bottom = "40px";
      modal.style.left = "40px";
      modal.style.right = "";
      modal.style.top = "";
    }
    modal.style.display = "flex";
    modalInner.classList.remove("modal-animate-out");
    modalInner.classList.add("modal-animate-in");
    clearTimeout(likeAuthModalTimeout);
    likeAuthModalTimeout = setTimeout(() => {
      hideLikeAuthModal();
    }, 5000);
  }
}
function hideLikeAuthModal() {
  const modal = document.getElementById("like-auth-modal");
  const modalInner = document.getElementById("like-auth-modal-inner");
  if (modal && modalInner) {
    modalInner.classList.remove("modal-animate-in");
    modalInner.classList.add("modal-animate-out");
    setTimeout(() => {
      modal.style.display = "none";
    }, 450);
  }
  clearTimeout(likeAuthModalTimeout);
}
// Cerrar modal si el usuario hace click en el botón de login
document.addEventListener("DOMContentLoaded", function () {
  const loginBtn = document.getElementById("like-auth-login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", function () {
      hideLikeAuthModal();
    });
  }

});

// Asignar lógica al botón de like
document.addEventListener("click", function (e) {
  const likeBtn = e.target.closest(".like-btn");
  if (likeBtn) {
    if (!window.USUARIO_AUTENTICADO) {
      e.preventDefault();
      showLikeAuthModal();
      return false;
    }
    // Aquí iría la lógica real de like para usuarios autenticados
  }
});

// Mejorar tamaño/flotante del botón de like en móvil
function updateLikeBtnStyles() {
  const isMobile = window.innerWidth < 768;
  document.querySelectorAll(".like-btn .like-icon").forEach((icon) => {
    if (isMobile) {
      icon.classList.add("w-9", "h-9");
      icon.classList.remove("w-7", "h-7", "w-6", "h-6", "w-5", "h-5");
    } else {
      icon.classList.remove("w-9", "h-9");
      icon.classList.add("w-6", "h-6", "md:w-5", "md:h-5");
    }
  });
}
window.addEventListener("resize", updateLikeBtnStyles);
document.addEventListener("DOMContentLoaded", updateLikeBtnStyles);
