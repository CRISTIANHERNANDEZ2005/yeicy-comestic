/**
 * MEJORA PROFESIONAL: Función de Voto Global y Reutilizable.
 * Se extrae la lógica de voto fuera de la clase para que pueda ser utilizada
 * por cualquier componente en la aplicación (ej. sección de reseñas en el index,
 * página de detalles del producto, etc.).
 *
 * @param {string} reviewId - El ID de la reseña a votar.
 * @param {HTMLElement} button - El botón que fue presionado.
 */
async function voteForReview(reviewId, button) {
  // 1. MEJORA PROFESIONAL: Verificar autenticación ANTES de cualquier cambio en la UI.
  const isAuthenticated = window.USUARIO_AUTENTICADO || (document.body.dataset.userId != null);
  if (!isAuthenticated) {
    // Si no está autenticado, mostrar un mensaje claro y detener la ejecución.
    if (window.toast && typeof window.toast.info === 'function') {
      window.toast.info("Debes iniciar sesión para votar.", 3000, {
        action: {
          text: 'Iniciar Sesión',
          // Dispara el evento para mostrar el modal de autenticación.
          onClick: () => document.dispatchEvent(new CustomEvent('showAuthModal'))
        }
      });
    }
    return;
  }

  // 2. Prevenir clics múltiples
  button.disabled = true;

  const countSpan = button.querySelector(".vote-count");
  const icon = button.querySelector("svg");
  const isCurrentlyVoted = button.classList.contains("voted");

  // 3. Actualización optimista de la UI
  button.classList.toggle("voted");
  const currentCount = parseInt(countSpan.textContent.match(/\d+/)[0], 10);
  countSpan.textContent = `${isCurrentlyVoted ? currentCount - 1 : currentCount + 1} útil`;
  icon.setAttribute("fill", !isCurrentlyVoted ? "currentColor" : "none");

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`/api/reviews/${reviewId}/vote`, {
      method: "POST",
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error en la votación.");

    // 4. Sincronizar con la respuesta final del servidor
    countSpan.textContent = `${data.votos_utiles_count} útil`;
    const serverVoted = data.accion === "voto_agregado";
    button.classList.toggle("voted", serverVoted);
    icon.setAttribute("fill", serverVoted ? "currentColor" : "none");

  } catch (error) {
    // 5. Revertir el cambio si la API falla y notificar
    button.classList.toggle("voted"); // Revertir clase
    countSpan.textContent = `${currentCount} útil`; // Revertir contador
    icon.setAttribute("fill", isCurrentlyVoted ? "currentColor" : "none"); // Revertir ícono
    if (window.toast) window.toast.error(error.message || "No se pudo registrar tu voto.", "error");
  } finally {
    button.disabled = false; // Volver a habilitar el botón
  }
}

class ReviewsManager {
  // Sistema de Reseñas 2.0 - Cliente API Profesional
  constructor() {
    const wrapper = document.getElementById("reviews-section-wrapper");
    this.productId = wrapper ? wrapper.dataset.productId : null;
    this.user = null;
    this.userReview = null;

    this.currentPage = 1;
    this.currentRatingFilter = null;
    this.currentSort = "newest";
    this.isLoading = false;
    this.hasMore = true;
    this.reviews = new Map();
    this.currentTotal = 0; // MEJORA: Propiedad para rastrear el total de la consulta actual.
    this.formRating = 0;

    this.init();
  }

  async init() {
    // La verificación de autenticación ahora es el primer paso y bloquea la inicialización de la UI.
    await this.checkAuthentication();
    this.bindEvents();
    await this.loadReviews(); // loadReviews ahora maneja la lógica de estado del botón
    this.setupInfiniteScroll();
    this.renderFilterChips();
    this.updateActiveFiltersDisplay();
  }

  bindEvents() {
    document.addEventListener("click", this.handleClick.bind(this));
    document.addEventListener("change", this.handleChange.bind(this));
    document.addEventListener("input", this.handleInput.bind(this));
    document.addEventListener("submit", this.handleSubmit.bind(this));
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        !document.getElementById("reviewModal").classList.contains("hidden")
      ) {
        this.closeModal();
      }
    });
    document.getElementById("reviewModal").addEventListener("click", (e) => {
      if (e.target.id === "reviewModal") this.closeModal();
    });

    // Nuevo: eventos para modal de eliminación
    document
      .getElementById("cancel-delete")
      .addEventListener("click", () => this.closeDeleteModal());
    document
      .getElementById("confirm-delete")
      .addEventListener("click", () => this.confirmDeleteReview());
    document
      .getElementById("deleteReviewModal")
      .addEventListener("click", (e) => {
        if (e.target.id === "deleteReviewModal") this.closeDeleteModal();
      });
  }

  handleClick(e) {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const actionMap = {
      "write-review": () => this.handleWriteReview(),
      "close-modal": () => this.closeModal(),
      "set-rating": () => this.setRating(parseInt(target.dataset.rating, 10)),
      "edit-review": () => this.editReview(target.dataset.reviewId),
      "delete-review": () => this.openDeleteModal(target.dataset.reviewId),
      "close-delete-modal": () => this.closeDeleteModal(),
      "filter-rating": () =>
        this.filterByRating(
          target.dataset.rating ? parseInt(target.dataset.rating, 10) : null
        ),
      "clear-filters": () => this.clearFilters(),
      "remove-filter": () =>
        this.removeSpecificFilter(target.dataset.filterType),
    };

    if (action === "vote-review") {
      // MEJORA: Prevenir que la acción de voto se propague y active otros listeners.
      e.preventDefault();
      voteForReview(target.dataset.reviewId, target);
    }

    if (actionMap[action]) {
      actionMap[action]();
    }
  }

  handleChange(e) {
    if (e.target.id === "sort-order") {
      this.currentSort = e.target.value;
      this.refreshReviews();
      this.updateActiveFiltersDisplay();
    }
  }

  handleInput(e) {
    const { id, value } = e.target;
    if (id === "review-text") this.updateCharCount(value.length);
    if (["review-title", "review-text"].includes(id)) this.validateForm();
  }

  handleSubmit(e) {
    if (e.target.id === "review-form") {
      e.preventDefault();
      this.submitReview();
    }
  }

  getAuthHeaders() {
    const token = localStorage.getItem("token");
    return token
      ? {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      : { "Content-Type": "application/json" };
  }

  /**
   * MEJORA PROFESIONAL: La verificación de autenticación ahora consulta al servidor.
   * En lugar de decodificar el token en el cliente (lo cual es inseguro y no detecta expiración),
   * se hace una petición al endpoint `/auth/me`. El interceptor (`auth_interceptor.js`)
   * se encarga de la lógica de validación.
   * Esto asegura que `this.user` solo se establece si la sesión es 100% válida en el backend.
   */
  async checkAuthentication() {
    // MEJORA: Esta función ahora devuelve un booleano para indicar si la autenticación fue exitosa.
    const token = localStorage.getItem("token");
    if (!token) {
      this.user = null;
      return false;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: this.getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        this.user = data.usuario
          ? { id: data.usuario.id, ...data.usuario }
          : null;
        return !!this.user; // Devuelve true si el usuario se estableció correctamente.
      } else {
        this.user = null;
        return false;
      }
    } catch (error) {
      console.error("Error al verificar la sesión del usuario:", error);
      this.user = null;
      return false;
    }
  }

  // Modal de agregar/editar reseña
  openModal(isEdit = false, review = null) {
    const modal = document.getElementById("reviewModal");
    const form = document.getElementById("review-form");
    const submitButtonText = document.querySelector(
      "#submit-review .submit-text"
    );
    form.reset();
    this.updateCharCount(0);
    this._clearValidationStates(); // MEJORA: Limpiar estados de validación al abrir.

    if (isEdit && review) {
      document.getElementById("modal-title").textContent = "Editar tu reseña";
      document.getElementById("review-id").value = review.id;
      document.getElementById("review-title").value = review.titulo;
      document.getElementById("review-text").value = review.texto;
      this.setRating(review.calificacion);
      if (submitButtonText) {
        submitButtonText.textContent = "Editar reseña";
      }
    } else {
      document.getElementById("modal-title").textContent =
        "Escribir una reseña";
      document.getElementById("review-id").value = "";
      this.setRating(0);
      if (submitButtonText) {
        submitButtonText.textContent = "Publicar reseña";
      }
    }

    this.validateForm();
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  closeModal() {
    document.getElementById("reviewModal").classList.add("hidden");
    this._clearValidationStates(); // MEJORA: Limpiar estados de validación al cerrar.
    document.body.style.overflow = "";
  }

  handleWriteReview() {
    if (!this.user) {
      this.showToast("Debes iniciar sesión para dejar una reseña.", "info");
      return;
    }
    this.openModal(!!this.userReview, this.userReview);
  }

  editReview(reviewId) {
    const review = this.reviews.get(reviewId);
    if (review) {
      this.openModal(true, review);
    } else {
      this.showToast("No se pudo encontrar la reseña para editar.", "error");
    }
  }

  // Modal de eliminación
  openDeleteModal(reviewId) {
    this.reviewToDelete = reviewId;

    document.getElementById("deleteReviewModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  closeDeleteModal() {
    document.getElementById("deleteReviewModal").classList.add("hidden");
    document.body.style.overflow = "";
    this.reviewToDelete = null;
  }

  async confirmDeleteReview() {
    const reviewIdToDelete = this.reviewToDelete; // Store the ID in a local variable
    if (!reviewIdToDelete) {
      // Use the local variable for the check

      return;
    }

    try {
      this.setDeleteButtonLoading(true);
      const response = await fetch(
        `/api/productos/${this.productId}/reviews/${reviewIdToDelete}`,
        { method: "DELETE", headers: this.getAuthHeaders() }
      );
      const result = await response.json();

      if (response.ok && result.success) {
        this.showToast(result.mensaje, "success");
        this.closeDeleteModal();

        const reviewElement = document.querySelector(
          `[data-review-id="${reviewIdToDelete}"]`
        );
        if (reviewElement) {
          reviewElement.style.transition = "opacity 0.3s, transform 0.3s";
          reviewElement.style.opacity = "0";
          reviewElement.style.transform = "scale(0.95)";
          setTimeout(async () => {
            reviewElement.remove();
            this.reviews.delete(reviewIdToDelete);
            if (this.userReview && this.userReview.id === reviewIdToDelete) {
              this.userReview = null;
              this.updateReviewButtonState();
            }
            this.updateContainerVisibility();

            const ratingResponse = await fetch(
              `/api/productos/${this.productId}/rating`
            );
            const ratingData = await ratingResponse.json();
            if (ratingData.success) {
              if (typeof updateProductRatingDisplay === "function") {
                updateProductRatingDisplay(
                  this.productId,
                  ratingData.average_rating,
                  ratingData.total_reviews_count
                );
              }
              this.updateStats(ratingData);
            }
          }, 300);
        } else {
        }
      } else {
        this.showToast(result.error || "Error al eliminar la reseña.", "error");
      }
    } catch (error) {
      console.error("Error al eliminar la reseña:", error);
      this.showToast("Error de conexión.", "error");
    } finally {
      this.setDeleteButtonLoading(false);
    }
  }

  // Lógica del formulario
  setRating(rating) {
    this.formRating = rating;
    document.getElementById("review-rating").value = rating;
    const starsContainer = document.getElementById("rating-stars");
    starsContainer.innerHTML = "";

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("div");
      star.dataset.action = "set-rating";
      star.dataset.rating = i;
      star.classList.add("star");
      if (i <= rating) star.classList.add("selected");
      star.innerHTML = `<svg class="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
      starsContainer.appendChild(star);
    }
    this.validateForm();
  }

  updateCharCount(length) {
    document.getElementById("char-count").textContent = length;
  }

  // MEJORA PROFESIONAL: Lógica de validación granular
  _validateField(field) {
    const value = field.value.trim();
    const errorElement = document.getElementById(`${field.id}-error`);
    let isValid = true;
    let errorMessage = "";

    switch (field.id) {
      case "review-title":
        if (value.length < 3) {
          isValid = false;
          errorMessage = "El título debe tener al menos 3 caracteres.";
        } else if (value.length > 100) {
          isValid = false;
          errorMessage = "El título no puede exceder los 100 caracteres.";
        }
        break;
      case "review-text":
        if (value.length < 10) {
          isValid = false;
          errorMessage = "La reseña debe tener al menos 10 caracteres.";
        } else if (value.length > 1000) {
          isValid = false;
          errorMessage = "La reseña no puede exceder los 1000 caracteres.";
        }
        break;
    }

    if (isValid) {
      field.classList.remove("border-red-500");
      field.classList.add("border-green-500");
      if (errorElement) errorElement.classList.add("hidden");
    } else {
      field.classList.remove("border-green-500");
      field.classList.add("border-red-500");
      if (errorElement) {
        errorElement.textContent = errorMessage;
        errorElement.classList.remove("hidden");
      }
    }
    return isValid;
  }

  _clearValidationStates() {
    const fields = ["review-title", "review-text"];
    fields.forEach(id => {
      const field = document.getElementById(id);
      const errorElement = document.getElementById(`${id}-error`);
      if (field) {
        field.classList.remove("border-red-500", "border-green-500");
      }
      if (errorElement) {
        errorElement.classList.add("hidden");
      }
    });
    const ratingError = document.getElementById("rating-error");
    if (ratingError) ratingError.classList.add("hidden");
  }

  validateForm() {
    const isTitleValid = this._validateField(document.getElementById("review-title"));
    const isTextValid = this._validateField(document.getElementById("review-text"));
    const isRatingValid = this.formRating > 0;
    document.getElementById("rating-error").classList.toggle("hidden", isRatingValid);

    const submitBtn = document.getElementById("submit-review");
    submitBtn.disabled = !(isTitleValid && isTextValid && isRatingValid);
  }

  async submitReview() {
    const submitBtn = document.getElementById("submit-review");
    const reviewId = document.getElementById("review-id").value;

    const body = {
      calificacion: this.formRating,
      titulo: document.getElementById("review-title").value,
      texto: document.getElementById("review-text").value,
    };

    this.setButtonLoading(submitBtn, true);

    try {
      const method = reviewId ? "PUT" : "POST";
      const endpoint = reviewId
        ? `/api/productos/${this.productId}/reviews/${reviewId}`
        : `/api/productos/${this.productId}/reviews`;

      const response = await fetch(endpoint, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (response.ok && result.success) {
        this.showToast(result.mensaje, "success");
        this.closeModal();

        if (method === "POST") {
          if (
            this.user &&
            result.review.usuario &&
            this.user.id === result.review.usuario.id
          ) {
            result.review.puede_editar = true;
          }
          const newReviewElement = this.createReviewElement(result.review);
          // MEJORA PROFESIONAL: Aplicar el estilo de destaque inmediatamente.
          newReviewElement.classList.add("border-2", "border-pink-500", "shadow-lg");
          const container = document.getElementById("reviews-list");

          container.prepend(newReviewElement);
          this.reviews.set(result.review.id, result.review);
          this.userReview = result.review;
          this.updateReviewButtonState();
          this.updateContainerVisibility();
        } else {
          const existingReviewElement = document.querySelector(
            `[data-review-id="${result.review.id}"]`
          );
          if (existingReviewElement) {
            if (
              this.user &&
              result.review.usuario &&
              this.user.id === result.review.usuario.id
            ) {
              result.review.puede_editar = true;
            }
            const updatedReviewElement = this.createReviewElement(
              result.review
            );
            existingReviewElement.replaceWith(updatedReviewElement);
            this.reviews.set(result.review.id, result.review);
            this.userReview = result.review;
            this.updateReviewButtonState();
            this.updateContainerVisibility();
          } else {
            this.refreshReviews();
          }
        }

        const ratingResponse = await fetch(
          `/api/productos/${this.productId}/rating`
        );
        const ratingData = await ratingResponse.json();
        if (ratingData.success) {
          if (typeof updateProductRatingDisplay === "function") {
            updateProductRatingDisplay(
              this.productId,
              ratingData.average_rating,
              ratingData.total_reviews_count
            );
          }
          this.updateStats(ratingData);
        }
      } else {
        // MEJORA PROFESIONAL: Manejo específico del error 403.
        // Si el backend nos dice que no podemos reseñar, mostramos el mensaje y nos aseguramos
        // de que el botón de "Escribir reseña" quede deshabilitado.
        if (response.status === 403) {
          this.showToast(
            result.error || "No tienes permiso para realizar esta acción.",
            "error"
          );
          this.updateReviewButtonState(); // Vuelve a verificar y deshabilitar el botón.
        } else {
          this.showToast(
            result.error || "Ocurrió un error en el servidor",
            "error"
          );
        }
      }
    } catch (error) {
      console.error("Error al enviar la reseña:", error);
      this.showToast("Error de conexión al enviar la reseña.", "error");
    } finally {
      this.setButtonLoading(submitBtn, false);
    }
  }

  // --- Lógica de Carga y Renderizado ---

  showLoadingState(reset = true) {
    const container = document.getElementById("reviews-list");
    const scrollContainer = document.getElementById("reviews-scroll-container");
    const emptyState = document.getElementById("empty-state");

    this.disconnectViewObserver(); // Detener observador antes de limpiar
    emptyState.classList.add("hidden");
    if (scrollContainer) scrollContainer.classList.remove("hidden");

    if (reset && container) {
      const skeleton = `<div class="animate-pulse"><div class="bg-white rounded-xl shadow-sm p-4 space-y-3 border border-gray-100"><div class="flex items-center space-x-3"><div class="w-8 h-8 bg-gray-300 rounded-full"></div><div class="flex-1 space-y-1"><div class="h-3 bg-gray-300 rounded w-3/4"></div><div class="h-2 bg-gray-200 rounded w-1/2"></div></div></div><div class="space-y-2"><div class="h-3 bg-gray-300 rounded w-full"></div><div class="h-3 bg-gray-200 rounded w-5/6"></div><div class="h-3 bg-gray-200 rounded w-4/6"></div></div></div></div>`;
      container.innerHTML = skeleton.repeat(6);
    }
  }

  hideLoadingState() {
    document
      .querySelectorAll("#reviews-list .animate-pulse")
      .forEach((s) => s.remove());
  }

  showErrorState(message = "Error al cargar las reseñas.") {
    const container = document.getElementById("reviews-list");
    container.innerHTML = `<div class="text-center py-10 bg-red-50 rounded-lg border border-red-200"><p class="font-semibold text-red-600">${message}</p><p class="text-sm text-gray-600 mt-1">Por favor, intenta de nuevo más tarde.</p></div>`;
  }

  async loadReviews(reset = true) {
    if (this.isLoading) return;
    this.isLoading = true;
    if (reset) {
      this.currentPage = 1;
      this.reviews.clear();
      document.getElementById("reviews-list").innerHTML = "";
    }

    this.showLoadingState(reset);

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        per_page: 12,
        sort: this.currentSort,
        ...(this.currentRatingFilter && { rating: this.currentRatingFilter }),
      });

      const response = await fetch(
        `/api/productos/${this.productId}/reviews?${params}`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();


      if (data.success) {
        this.appendReviews(data);
        this.hasMore = data.page < data.pages;
        this.currentTotal = data.total; // MEJORA: Almacenar el total de resultados de la consulta.
        // MEJORA: Las estadísticas y la visibilidad se actualizan aquí, en un único lugar.
        this.updateStats(data);
      } else {
        throw new Error(data.error || "La API devolvió un error.");
      }
    } catch (error) {
      console.error("Error al cargar reseñas:", error);
      this.showErrorState(error.message);
    } finally {
      this.isLoading = false;
      this.hideLoadingState();
      this.updateContainerVisibility(); // MEJORA: Llamar a la función que gestiona qué mostrar (lista, estado vacío, etc.)
      
      // MEJORA PROFESIONAL: Determinar si la reseña del usuario está en la página actual
      // y actualizar el estado del botón "Escribir/Editar reseña".
      this.userReview = null; // Resetear
      for (const review of this.reviews.values()) {
          if (review.puede_editar) {
              this.userReview = review;
              break;
          }
      }

      this.updateReviewButtonState(); // Actualizar el estado del botón después de cargar las reseñas.
    }
  }

  appendReviews(data) {
    const container = document.getElementById("reviews-list");
    const writeFirstReviewBtn = document.getElementById(
      "write-first-review-btn"
    );
    // Add reviews to the map
    data.reviews.forEach((review) => {
      // Check if the current user is the author of the review
      if (this.user && review.usuario && this.user.id === review.usuario.id) {
        review.puede_editar = true;
      } else {
        review.puede_editar = false; // Ensure it's false if not the owner
      }
      this.reviews.set(review.id, review);
    });

    // MEJORA PROFESIONAL: Lógica de renderizado unificada para evitar sobrescrituras.
    // Si es una carga nueva (página 1), limpiar el contenedor.
    if (this.currentPage === 1) {
      container.innerHTML = "";
    }

    const fragment = document.createDocumentFragment();

    // MEJORA PROFESIONAL: Renderizar la lista unificada que ya viene ordenada desde el backend.
    data.reviews.forEach((review) => {
      const reviewElement = this.createReviewElement(review);
      // Si la reseña pertenece al usuario actual, la destacamos.
      if (review.puede_editar) {
          reviewElement.classList.add("border-2", "border-pink-500", "shadow-lg");
      }
      fragment.appendChild(reviewElement);
    });
    container.appendChild(fragment);
    this.animateReviewsIn();
    this.observeReviewsForViewCount(); // Reactivar observador
    this.updateContainerVisibility(); // Update visibility after reviews are appended
  }

  updateStats(data) {
    document.getElementById("avg-rating-value").textContent = (
      data.average_rating || 0
    ).toFixed(1);
    document.getElementById("total-reviews").textContent =
      data.total_reviews_count || 0;
    document.getElementById("average-rating").innerHTML =
      this.generateStarsHTML(Math.round(data.average_rating || 0));
  }

  createReviewElement(review) {
    const div = document.createElement("div");
    div.className =
      "bg-white rounded-xl shadow-sm p-4 border border-gray-100 review-item hover:shadow-md transition-shadow duration-300";
    div.dataset.reviewId = review.id;

    div.innerHTML =
      `
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center space-x-3">
            <img class="h-9 w-9 rounded-full object-cover flex-shrink-0" src="${
              review.usuario.avatar_url ||
              "https://i.pravatar.cc/32?u=" + review.usuario.id
            }" alt="${review.usuario.nombre}">
            <div class="min-w-0">
              <p class="text-sm font-bold text-gray-900 truncate">${
                review.usuario.nombre
              }</p>
              <p class="text-xs text-gray-500">${this.formatDate(
                review.created_at
              )}</p>
            </div>
          </div>
          <div class="flex items-center flex-shrink-0" title="Calificación: ${
            review.calificacion
          } de 5">
            ${this.generateStarsHTML(review.calificacion)}
          </div>
        </div>
        
        <div class="space-y-2">
          <h4 class="font-bold text-gray-800 text-base leading-tight">${
            review.titulo || ""
          }</h4>
          <p class="text-gray-600 text-sm leading-relaxed line-clamp-4">${
            review.texto
          }</p>
        </div>` +
      // --- INICIO: Diseño unificado de Votos y Vistas ---
      `<div class="pt-3 border-t border-gray-100 mt-3 flex items-center justify-between text-xs text-gray-500">
          <div class="flex items-center space-x-4">` +
      // MEJORA: Botón de Voto funcional para cualquier usuario autenticado.
      (this.user
        ? `
            <button data-action="vote-review" data-review-id="${
              review.id
            }" class="flex items-center space-x-1 hover:text-pink-600 transition-colors group vote-button ${
            review.current_user_voted ? "voted" : "" // MEJORA: Aplicar clase 'voted' si el usuario ya votó
          }" title="Marcar como útil">
              <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="${
                review.current_user_voted ? "currentColor" : "none" // MEJORA: Rellenar el ícono si el usuario ya votó
              }" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"></path></svg>
              <span class="font-medium vote-count">${
                review.votos_utiles_count || 0
              } útil</span>
            </button>
          `
        : `
            <span class="flex items-center space-x-1" title="Votos útiles">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"></path></svg>
              <span class="font-medium vote-count">${
                review.votos_utiles_count || 0
              } útil</span>
            </span>
          `) +
      // Contador de Vistas (solo visual)
      `<span class="flex items-center space-x-1" title="Vistas">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <span class="font-medium view-count">${
                review.visitas || 0
              } vistas</span>
          </span>
        </div>` +
      // --- FIN: Diseño unificado ---
      `
            ${
              review.puede_editar
                ? `
            <div class="flex justify-end space-x-2">
                <button data-action="edit-review" data-review-id="${review.id}" class="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">Editar</button>
                <button data-action="delete-review" data-review-id="${review.id}" class="text-xs font-medium text-red-600 hover:text-red-700 transition-colors">Eliminar</button>
            </div>
            `
                : ""
            }
        </div>`;
    return div;
  }

  calculateAverageRating() {
    if (this.reviews.size === 0) return 0.0;
    let totalRating = 0;
    this.reviews.forEach((review) => {
      totalRating += review.calificacion;
    });
    return totalRating / this.reviews.size;
  }

  // --- Filtros y Ordenamiento ---

  renderFilterChips() {
    const container = document.getElementById("rating-filters");
    const ratings = [null, 5, 4, 3, 2, 1]; // null para "Todos"
    container.innerHTML = ratings
      .map((rating) => {
        const isActive = this.currentRatingFilter === rating;
        const text = rating ? `${rating} estrellas` : "Todos";
        const starHtml = rating
          ? `<span class="star-icon"></span>`.repeat(rating)
          : "";
        return `<button data-action="filter-rating" data-rating="${
          rating || ""
        }" class="rating-chip ${
          isActive ? "active" : ""
        }">${text} ${starHtml}</button>`;
      })
      .join("");
  }

  filterByRating(rating) {
    this.currentRatingFilter = rating;
    this.renderFilterChips();
    this.refreshReviews();
    this.updateActiveFiltersDisplay();
  }

  clearFilters() {
    // --- MEJORA PROFESIONAL: Transición de UI inmediata ---
    // Ocultar el mensaje de "no resultados" y mostrar el estado de carga
    // ANTES de iniciar la petición a la API para una experiencia fluida.
    const noResultsMessage = document.getElementById("no-results-message"); // Corregido: no-results-message
    if (noResultsMessage) noResultsMessage.classList.add("hidden"); // Corregido: no-results-message

    // Mostrar el contenedor de la lista con los esqueletos de carga.
    this.showLoadingState(true);

    this.currentRatingFilter = null;
    this.currentSort = "newest"; // Corregido: "newest"
    document.getElementById("sort-order").value = "newest"; // Update select dropdown
    this.renderFilterChips(); 
    this.refreshReviews(); 
    this.updateActiveFiltersDisplay();
  }

  updateActiveFiltersDisplay() {
    const activeFiltersContainer = document.getElementById("active-filters");
    const activeFiltersList = document.getElementById("active-filters-list");

    const activeFilters = [];

    if (this.currentRatingFilter !== null) {
      activeFilters.push({
        type: "rating",
        label: `${this.currentRatingFilter} estrellas`,
        value: this.currentRatingFilter,
      });
    }

    if (this.currentSort !== "newest") {
      const sortLabels = {
        oldest: "Más antiguas",
        rating_desc: "Mejor valoradas",
        rating_asc: "Peor valoradas",
      };
      activeFilters.push({
        type: "sort",
        label: sortLabels[this.currentSort] || this.currentSort,
        value: this.currentSort,
      });
    }

    if (activeFilters.length > 0) {
      activeFiltersContainer.classList.remove("hidden");
      activeFiltersList.innerHTML = activeFilters
        .map(
          (filter) => `
                <div class="filter-tag">
                    ${filter.label}
                    <button data-action="remove-filter" data-filter-type="${filter.type}" class="ml-1 -mr-1 p-1 rounded-full hover:bg-amber-200 transition-colors">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            `
        )
        .join("");
    } else {
      activeFiltersContainer.classList.add("hidden");
    }
  }

  removeSpecificFilter(filterType) {
    if (filterType === "rating") {
      this.currentRatingFilter = null;
      this.renderFilterChips();
    } else if (filterType === "sort") {
      this.currentSort = "newest";
      document.getElementById("sort-order").value = "newest";
    }

    this.refreshReviews();
    this.updateActiveFiltersDisplay();
  }

  refreshReviews() {
    this.disconnectViewObserver();
    this.loadReviews(true);
    this.updateReviewButtonState();
  }

  // --- Helpers ---

  setupInfiniteScroll() {
    this.disconnectViewObserver(); // Asegurarse de que no haya observadores previos
    const sentinel = document.createElement("div");
    sentinel.id = "scroll-sentinel";
    document.getElementById("reviews-container").appendChild(sentinel);

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.isLoading && this.hasMore) {
          this.disconnectViewObserver();
          this.currentPage++;
          this.loadReviews(false);
        }
      },
      { rootMargin: "200px" }
    );
    this.scrollObserver.observe(sentinel);
  }

  disconnectViewObserver() {
    if (this.viewObserver) {
      this.viewObserver.disconnect();
      this.viewObserver = null;
    }
  }

  observeReviewsForViewCount() {
    this.disconnectViewObserver(); // Limpiar observador anterior

    // MEJORA PROFESIONAL: Usar sessionStorage para rastrear vistas por sesión.
    const viewedInSessionKey = `viewed_reviews_${this.productId}`;
    try {
      const viewedIds =
        JSON.parse(sessionStorage.getItem(viewedInSessionKey)) || [];
      this.viewedReviewsInSession = new Set(viewedIds);
    } catch (e) {
      this.viewedReviewsInSession = new Set();
    }

    this.viewObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const reviewId = entry.target.dataset.reviewId;
            // Solo registrar la vista si NO ha sido vista en esta sesión.
            if (!this.viewedReviewsInSession.has(reviewId)) {
              this.viewedReviewsInSession.add(reviewId);
              // Actualizar sessionStorage para persistir en la sesión actual.
              sessionStorage.setItem(
                viewedInSessionKey,
                JSON.stringify(Array.from(this.viewedReviewsInSession))
              );

              this.incrementViewCount(reviewId);
              observer.unobserve(entry.target); // Dejar de observar una vez contado.
            }
          }
        });
      },
      { threshold: 0.5 }
    ); // Contar cuando el 50% de la reseña es visible.

    document
      .querySelectorAll(".review-item:not(.view-observed)")
      .forEach((item) => {
        item.classList.add("view-observed");
        this.viewObserver.observe(item);
      });
  }

  async incrementViewCount(reviewId) {
    // La lógica de la petición se mantiene, pero ahora solo se llama una vez por sesión.
    try {
      const response = await fetch(`/api/reviews/${reviewId}/view`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        // MEJORA PROFESIONAL: Actualizar el contador de vistas en tiempo real.
        const reviewElement = document.querySelector(
          `.review-item[data-review-id="${reviewId}"]`
        );
        if (reviewElement) {
          const viewCountSpan = reviewElement.querySelector(".view-count");
          if (viewCountSpan) {
            viewCountSpan.textContent = data.visitas;
          }
        }
      }
    } catch (error) {
      console.error(
        `Error al registrar vista para la reseña ${reviewId}:`,
        error
      );
    }
  }

  // MEJORA PROFESIONAL: El método de la clase ahora es un simple wrapper
  // que llama a la función global reutilizable.
  async voteForReview(reviewId, button) {
    // Llama a la función global. El `await` es opcional aquí, ya que la
    // función global maneja su propia UI y estado de forma independiente.
    await voteForReview(reviewId, button);
  }

  animateReviewsIn() {
    document
      .querySelectorAll(".review-item:not(.animated-in)")
      .forEach((review, index) => {
        review.classList.add("animated-in");
        review.style.opacity = "0";
        review.style.transform = "translateY(20px)";
        setTimeout(() => {
          review.style.transition = "opacity 0.5s ease, transform 0.5s ease";
          review.style.opacity = "1";
          review.style.transform = "translateY(0)";
        }, index * 50);
      });
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  generateStarsHTML(rating) {
    let stars = "";
    for (let i = 1; i <= 5; i++) {
      stars += `<svg class="w-4 h-4 ${
        i <= rating ? "text-yellow-400" : "text-gray-300"
      }" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
    }
    return stars;
  }

  /**
   * MEJORA PROFESIONAL: Esta función es ahora la única fuente de verdad para el estado del botón de reseña.
   * Se asegura de que el botón esté deshabilitado por defecto y solo se active si la API lo permite explícitamente.
   */
  updateReviewButtonState() {
    const button = document.getElementById("write-review-btn");
    const text = document.getElementById("write-review-text");
    // MEJORA PROFESIONAL: Si el botón no existe en el DOM (porque el usuario no está autenticado),
    // no hay nada que hacer. Esto previene errores en la consola.
    if (!button || !text) return;

    if (!this.user) {
      text.textContent = "Escribir reseña";
      button.disabled = true;
      return;
    }

    if (this.userReview) {
      text.textContent = "Editar mi reseña";
    } else {
      text.textContent = "Escribir reseña";
    }
    button.disabled = false; // Habilitar el botón para usuarios autenticados.
  }

  setButtonLoading(button, isLoading) {
    const text = button.querySelector(".submit-text");
    const spinner = button.querySelector(".loading-spinner");
    button.disabled = isLoading;
    text.style.display = isLoading ? "none" : "inline-block";
    spinner.style.display = isLoading ? "inline-block" : "none";
  }

  showToast(message, type = "info") {
    if (type === "success") {
      if (window.toast && typeof window.toast.success === "function") {
        window.toast.success(message);
      } else {
        console.log("Éxito (sin toast):", message);
      }
    } else {
      console.error(`Mensaje (${type}):`, message);
    }
  }

  updateContainerVisibility() {
    const emptyState = document.getElementById("empty-state");
    const noResultsMessage = document.getElementById("no-results-message");
    const scrollContainer = document.getElementById("reviews-scroll-container");
    const reviewsWrapper = document.getElementById("reviews-section-wrapper");
    const filtersAndHeader = document.querySelectorAll(
      "#reviews-container > div:not(#reviews-scroll-container):not(#empty-state):not(#no-results-message)"
    );

    // Ocultar todos los contenedores de estado por defecto para un lienzo limpio.
    if (emptyState) emptyState.classList.add("hidden");
    if (noResultsMessage) noResultsMessage.classList.add("hidden");
    if (scrollContainer) scrollContainer.classList.add("hidden");

    // MEJORA PROFESIONAL: La lógica ahora se basa en el total de la consulta y los filtros activos.
    const hasActiveFilters = this.currentRatingFilter !== null || this.currentSort !== "newest";
    const hasAnyReviewsOnPage = this.reviews.size > 0;
    const queryReturnedResults = this.currentTotal > 0;

    if (queryReturnedResults || (hasAnyReviewsOnPage && !hasActiveFilters)) {
      // ESTADO 1: Hay reseñas. Mostrar todo el bloque y la lista.
      if (reviewsWrapper) reviewsWrapper.classList.remove("hidden");
      filtersAndHeader.forEach((el) => el.classList.remove("hidden"));
      if (scrollContainer) scrollContainer.classList.remove("hidden");
    } else {
      if (hasActiveFilters) {
        // ESTADO 2: No hay resultados para los filtros aplicados.
        // Mostrar el bloque de reseñas, los filtros y el mensaje de "no resultados".
        // **Asegurarse de que el contenedor de la lista esté oculto.**
        if (reviewsWrapper) reviewsWrapper.classList.remove("hidden");
        filtersAndHeader.forEach((el) => el.classList.remove("hidden"));
        if (noResultsMessage) noResultsMessage.classList.remove("hidden");
        if (scrollContainer) scrollContainer.classList.add("hidden"); // Corrección clave: Ocultar el contenedor de la lista.
      } else {
        // ESTADO 3: No hay reseñas en absoluto (y sin filtros). Mostrar el estado vacío. // Corregido: "newest"
        // MEJORA: Mostrar el estado vacío siempre que no haya reseñas, independientemente de si el usuario está autenticado.
        // El botón para escribir la reseña ya está condicionado en el HTML.
        if (reviewsWrapper) reviewsWrapper.classList.remove("hidden");
        filtersAndHeader.forEach((el) => el.classList.remove("hidden"));
        if (emptyState) emptyState.classList.remove("hidden");

        const writeFirstReviewBtn = document.getElementById(
          "write-first-review-btn"
        );
        if (writeFirstReviewBtn) writeFirstReviewBtn.classList.toggle("hidden", !this.user);
      }
    }
  }
  setDeleteButtonLoading(isLoading) {
    const button = document.getElementById("confirm-delete");
    if (!button) return;

    if (isLoading) {
      button.textContent = "Eliminando...";
      button.disabled = true;
      button.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      button.textContent = "Eliminar";
      button.disabled = false;
      button.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // MEJORA PROFESIONAL: Inicialización Condicional
  // Solo inicializar el gestor de reseñas si el contenedor específico existe en la página.
  // Esto evita errores en páginas como index.html que no tienen esta sección.
  if (document.getElementById("reviews-section-wrapper")) {
    window.reviewsManager = new ReviewsManager();
  }
});
