(function () {
  // Constantes y elementos del DOM
  const bg = document.getElementById("auth-modal-bg");
  const modal = document.getElementById("auth-modal");
  const closeBtn = document.getElementById("auth-modal-close");
  const loginTab = document.getElementById("auth-login-tab");
  const registerTab = document.getElementById("auth-register-tab");
  const loginForm = document.getElementById("auth-login-form");
  const registerForm = document.getElementById("auth-register-form");
  // --- INICIO: Nuevos elementos para el flujo de contraseña olvidada ---
  const forgotPasswordFlow = document.getElementById("auth-forgot-password-flow");
  const forgotPasswordStep1 = document.getElementById("auth-forgot-password-form-step1");
  const forgotPasswordStep2 = document.getElementById("auth-forgot-password-form-step2");
  const forgotPasswordStep3 = document.getElementById("auth-forgot-password-form-step3");
  const forgotPasswordStep4 = document.getElementById("auth-forgot-password-form-step4");
  const goToStep3Btn = document.getElementById("go-to-step3-btn");
  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const backToLoginLink = document.getElementById("back-to-login-link");
  const msg = document.getElementById("auth-modal-msg");

  // Expresiones regulares para validación
  const patterns = {
    phone: /^[0-9]{10}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    name: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s']+$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  };

  // Mensajes de error
  const errorMessages = {
    required: 'Este campo es obligatorio',
    phone: 'El número debe tener 10 dígitos',
    password: 'Mínimo 8 caracteres, una mayúscula, una minúscula y un número',
    name: 'Solo se permiten letras y espacios',
    email: 'Ingresa un correo electrónico válido',
    passwordMismatch: 'Las contraseñas no coinciden',
    confirmPassword: 'Por favor, confirma tu contraseña'
  };

  // Función para limpiar un formulario y sus estados
  function resetForm(form) {
    if (!form) return;
    
    // Resetear valores
    form.reset();
    
    // Limpiar clases de validación
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
      input.classList.remove('border-red-500', 'border-green-500');
      
      // Limpiar mensajes de error
      const errorElement = input.nextElementSibling?.classList?.contains('error-message') 
        ? input.nextElementSibling 
        : null;
      
      if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
      }
      
      // Resetear indicador de fortaleza de contraseña
      if (input.id.includes('password') || input.name === 'contraseña') {
        const strengthBars = document.querySelectorAll('.strength-bar');
        const strengthTextElement = document.querySelector('.strength-text');
        
        if (strengthBars.length && strengthTextElement) {
          strengthBars.forEach(bar => {
            bar.className = 'strength-bar h-1 w-1/4 mr-1 rounded-full bg-gray-600';
          });
          
          strengthTextElement.textContent = 'La contraseña es demasiado débil';
          strengthTextElement.className = 'strength-text text-xs text-gray-400';
        }
      }
    });
  }

  // Función para mostrar el modal de autenticación
  window.showAuthModal = function (mode = "login") {
    // Limpia el formulario que se va a ocultar
    if (mode === "register") {
      resetForm(loginForm);
      resetForgotPasswordFlow(); // Limpia todo el flujo de reseteo
    } else {
      resetForm(registerForm);
    }
    
    // Muestra el modal
    bg.classList.remove("hidden");
    bg.classList.add("flex");
    msg.classList.add("hidden");
    msg.textContent = "";
    msg.className = 'text-center text-sm font-semibold hidden';

    // Agrega animación
    modal.classList.add("animate-fade-in-up");

    if (mode === "register") {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
      forgotPasswordFlow.classList.add("hidden");
      
      // Actualiza estilos de las pestañas
      loginTab.classList.remove(
        "bg-gradient-to-r",
        "from-pink-500",
        "to-purple-500",
        "shadow-lg",
        "text-white"
      );
      loginTab.classList.add("text-white/80");
      
      registerTab.classList.add(
        "bg-gradient-to-r",
        "from-pink-500",
        "to-purple-500",
        "shadow-lg",
        "text-white"
      );
      registerTab.classList.remove("text-white/80");
    } else {
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
      forgotPasswordFlow.classList.add("hidden");
      
      // Actualiza estilos de las pestañas
      registerTab.classList.remove(
        "bg-gradient-to-r",
        "from-pink-500",
        "to-purple-500",
        "shadow-lg",
        "text-white"
      );
      registerTab.classList.add("text-white/80");
      
      loginTab.classList.add(
        "bg-gradient-to-r",
        "from-pink-500",
        "to-purple-500",
        "shadow-lg",
        "text-white"
      );
      loginTab.classList.remove("text-white/80");
    }
  };

  function closeModal() {
    bg.classList.add("hidden");
    bg.classList.remove("flex");
    msg.classList.add("hidden");
    loginForm.reset();
    registerForm.reset();
    resetForgotPasswordFlow();
  }

  // Función para resetear el flujo de contraseña olvidada a su estado inicial
  function resetForgotPasswordFlow() {
    forgotPasswordStep1.reset();
    forgotPasswordStep3.reset();
    if (forgotPasswordStep4) forgotPasswordStep4.reset();
    forgotPasswordStep1.classList.remove("hidden");
    forgotPasswordStep2.classList.add("hidden");
    forgotPasswordStep3.classList.add("hidden");
    if (forgotPasswordStep4) forgotPasswordStep4.classList.add("hidden");
  }

  closeBtn.onclick = closeModal;
  bg.onclick = function (e) {
    if (e.target === bg) closeModal();
  };
  loginTab.onclick = function () {
    window.showAuthModal("login");
  };
  registerTab.onclick = function () {
    window.showAuthModal("register");
  };

  // --- INICIO: Lógica para Olvidé mi Contraseña ---
  forgotPasswordLink.onclick = function () {
    // Oculta los formularios de login/registro y muestra el de reseteo
    loginForm.classList.add("hidden");
    registerForm.classList.add("hidden");
    forgotPasswordFlow.classList.remove("hidden");
    msg.classList.add("hidden");
    msg.textContent = "";
    resetForm(loginForm);
    resetForm(registerForm);
    resetForgotPasswordFlow();
  };

  backToLoginLink.onclick = function () {
    // Vuelve a mostrar el formulario de login
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    forgotPasswordFlow.classList.add("hidden");
    msg.classList.add("hidden");
    msg.textContent = "";
    resetForgotPasswordFlow();
  };

  goToStep3Btn.onclick = function() {
    forgotPasswordStep2.classList.add("hidden");
    forgotPasswordStep3.classList.remove("hidden");
  };

  // Función para validar un campo según su tipo
  function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name || field.id.replace('register-', '').replace('login-', '');
    const errorElement = field.nextElementSibling?.classList?.contains('error-message') 
      ? field.nextElementSibling 
      : null;

    // Si el campo está vacío y es requerido
    if (field.required && !value) {
      setFieldError(field, errorMessages.required, errorElement);
      return false;
    }

    // Validaciones específicas por tipo de campo
    let isValid = true;
    switch(fieldName) {
      case 'numero':
        isValid = patterns.phone.test(value);
        // MEJORA: No mostrar validación de formato de número en el login.
        // Solo se valida que no esté vacío (ya cubierto por 'required').
        if (field.id === 'login-numero') {
          isValid = true; // Se asume válido si no está vacío, la validación real la hace el backend.
          break;
        }
        if (!isValid) setFieldError(field, errorMessages.phone, errorElement);
        break;
      case 'password':
      case 'contraseña':
        isValid = patterns.password.test(value);
        // Para el campo de contraseña de inicio de sesión, no aplicamos la validación de formato detallada.
        // Solo se verifica si está vacío (lo cual ya está cubierto por la comprobación 'required' al inicio de la función).
        if (field.id === 'login-password') {
          isValid = true; // Consideramos el campo válido en el frontend si no está vacío, la validación real la hace el backend.
          break;
        }
        if (!isValid) setFieldError(field, errorMessages.password, errorElement);
        break;
      case 'nombre':
      case 'apellido':
        isValid = patterns.name.test(value);
        if (!isValid) setFieldError(field, errorMessages.name, errorElement);
        break;
      // --- INICIO: Nuevas validaciones para el formulario de reseteo ---
      case 'reset-new-password':
        isValid = patterns.password.test(value);
        if (!isValid) setFieldError(field, errorMessages.password, errorElement);
        break;
      case 'reset-confirm-password':
        const newPasswordValue = document.getElementById('reset-new-password').value.trim();
        if (!value) {
          setFieldError(field, errorMessages.confirmPassword, errorElement);
          return false; // Devolver false directamente
        }
        if (value !== newPasswordValue) {
          setFieldError(field, errorMessages.passwordMismatch, errorElement);
          return false; // Devolver false directamente
        }
        break;
      // --- FIN: Nuevas validaciones para el formulario de reseteo ---
        break;
      case 'email':
        isValid = patterns.email.test(value);
        if (!isValid) setFieldError(field, errorMessages.email, errorElement);
        break;
    }

    if (isValid) {
      setFieldSuccess(field, errorElement);
    }

    return isValid;
  }

  // Función para establecer estado de error en un campo
  function setFieldError(field, message, errorElement) {
    field.classList.remove('border-green-500');
    field.classList.add('border-red-500');
    
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  }

  // Función para establecer estado de éxito en un campo
  function setFieldSuccess(field, errorElement) {
    field.classList.remove('border-red-500');
    field.classList.add('border-green-500');
    
    if (errorElement) {
      errorElement.classList.add('hidden');
    }
  }

  // Función para verificar la fortaleza de la contraseña
  function checkPasswordStrength(password) {
    let strength = 0;
    const feedback = [];

    // Longitud mínima
    if (password.length >= 8) strength++;
    
    // Contiene letras minúsculas
    if (/[a-z]/.test(password)) strength++;
    
    // Contiene letras mayúsculas
    if (/[A-Z]/.test(password)) strength++;
    
    // Contiene números
    if (/[0-9]/.test(password)) strength++;
    
    // Contiene caracteres especiales
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    // Determinar nivel de fortaleza
    let strengthText = '';
    let strengthClass = '';
    
    if (password.length === 0) {
      strengthText = 'Ingresa una contraseña';
      strengthClass = 'text-gray-400';
    } else if (password.length < 8) {
      strengthText = 'Muy corta (mínimo 8 caracteres)';
      strengthClass = 'text-red-400';
    } else {
      switch(strength) {
        case 2:
          strengthText = 'Débil';
          strengthClass = 'text-red-500';
          break;
        case 3:
          strengthText = 'Moderada';
          strengthClass = 'text-yellow-500';
          break;
        case 4:
          strengthText = 'Fuerte';
          strengthClass = 'text-green-400';
          break;
        case 5:
          strengthText = 'Muy fuerte';
          strengthClass = 'text-green-500';
          break;
        default:
          strengthText = 'Muy débil';
          strengthClass = 'text-red-500';
      }
    }

    // Actualizar barras de fortaleza
    const strengthBars = document.querySelectorAll('.strength-bar');
    const strengthTextElement = document.querySelector('.strength-text');
    
    if (strengthBars.length && strengthTextElement) {
      strengthBars.forEach((bar, index) => {
        bar.className = `strength-bar h-1 w-1/4 mr-1 rounded-full ${index < strength ? strengthClass.replace('text-', 'bg-') : 'bg-gray-600'}`;
      });
      
      strengthTextElement.textContent = `Seguridad: ${strengthText}`;
      strengthTextElement.className = `strength-text text-xs ${strengthClass}`;
    }

    return strength;
  }

  // Configuración de validación en tiempo real
  function setupRealTimeValidation(form) {
    const inputs = form.querySelectorAll('input[required]');
    
    inputs.forEach(input => {
      // Crear elemento de error si no existe
      if (!input.nextElementSibling?.classList?.contains('error-message')) {
        const errorElement = document.createElement('p');
        errorElement.className = 'error-message text-xs text-red-500 mt-1 hidden';
        input.parentNode.insertBefore(errorElement, input.nextSibling);
      }

      // Validar al perder el foco
      input.addEventListener('blur', () => validateField(input));
      
      // Validar al escribir (con debounce para mejor rendimiento)
      let timeout;
      input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        
        // Validación en tiempo real para la contraseña
        if (input.id.includes('password') || input.name === 'contraseña') {
          checkPasswordStrength(e.target.value);
        }
        
        timeout = setTimeout(() => validateField(input), 500);
      });
    });
  }

  // Manejo de envío de formulario mejorado
  function handleSubmit(form, endpoint) {
    // Configurar validación en tiempo real
    setupRealTimeValidation(form);

    form.onsubmit = async function (e) {
      e.preventDefault();
      msg.classList.add("hidden");
      msg.textContent = "";

      // Validar todos los campos antes de enviar
      const inputs = form.querySelectorAll('input[required]');
      let isValid = true;
      
      inputs.forEach(input => {
        if (!validateField(input)) {
          isValid = false;
        }
      });

      if (!isValid) {
        msg.textContent = 'Por favor, completa correctamente todos los campos';
        msg.classList.remove('hidden', 'text-green-400');
        msg.classList.add('text-red-400');
        return;
      }

      // Mostrar estado de carga
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML =
        '<span class="flex items-center justify-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Procesando...</span>';
      submitBtn.disabled = true;

      try {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const result = await resp.json();

        if (resp.ok && (result.success || result.token)) {
          msg.textContent =
            endpoint === "/auth/register"
              ? "¡Registro exitoso! Redirigiendo..."
              : "¡Inicio de sesión exitoso! Redirigiendo...";
          msg.classList.remove("text-red-500", "hidden");
          msg.classList.add("text-green-400");

          // Guardar token e información del usuario en localStorage
          if (result.token) {
            if (window.auth && typeof window.auth.setAuthToken === 'function') {
              window.auth.setAuthToken(result.token);
            }
            localStorage.setItem('token', result.token); // Guardar token para uso en toda la app
            // Set global userId for cart synchronization
            window.userId = result.usuario.id;
            // Trigger cart synchronization immediately after login/registration
            if (window.cart) {
              await window.cart.mergeLocalCartWithServer();
            }
            if (window.favoritesManager) {
              window.favoritesManager.isAuthenticated = true;
            }
          }

          const authEvent = new CustomEvent('auth:success', {
            detail: { 
              usuario: result.usuario,
              token: result.token
            }
          });
          document.dispatchEvent(authEvent);

          setTimeout(() => {
            if (endpoint === "/auth/register") {
              window.showAuthModal("login");
            } else {
              window.location.href = '/';
            }
          }, 1500);
        } else {
          // Mostrar errores específicos en los campos si existen
          let fieldErrorShown = false;
          if (result && typeof result === 'object') {
            // Si el backend especifica el campo con error
            if (result.field && result.error) {
              const input = form.querySelector(`[name="${result.field}"]`);
              if (input) {
                setFieldError(input, result.error, input.nextElementSibling);
                fieldErrorShown = true;
              }
            } else {
              // Buscar errores de campos comunes por texto
              const fieldMap = {
                'numero': ['numero', 'phone', 'telefono'],
                'contraseña': ['contraseña', 'password'],
                'nombre': ['nombre'],
                'apellido': ['apellido']
              };
              Object.entries(fieldMap).forEach(([field, keys]) => {
                keys.forEach(key => {
                  if (result.error && result.error.toLowerCase().includes(key)) {
                    const input = form.querySelector(`[name="${field}"]`);
                    if (input) {
                      setFieldError(input, result.error, input.nextElementSibling);
                      fieldErrorShown = true;
                    }
                  }
                });
              });
            }
          }
          // Mensaje general arriba del formulario solo si no es error de campo
          if (!fieldErrorShown) {
            msg.textContent = result.error || result.message || "Error en el proceso. Verifica tus datos.";
            // MEJORA: No recargar la página en caso de error de login.
            // El interceptor ya no forzará la recarga, así que mostramos el mensaje aquí.
            msg.classList.remove("hidden", "text-green-400");
            msg.classList.add("text-red-400", "animate-shake");
            setTimeout(() => msg.classList.remove('animate-shake'), 500);
          }
        }
      } catch (err) {
        msg.textContent =
          err.message || "Error de conexión. Intenta nuevamente.";
        msg.classList.remove("text-green-400", "hidden");
        msg.classList.add("text-red-400");
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    };
  }

  // --- INICIO: Manejo del nuevo flujo de contraseña olvidada ---

  // Paso 1: Solicitar el código
  forgotPasswordStep1.onsubmit = async function (e) {
    e.preventDefault();
    msg.classList.add("hidden");
    
    const numeroInput = document.getElementById('forgot-numero'); // Se mantiene
    const apellidoInput = document.getElementById('forgot-nombre'); // Cambiado a nombre
    
    // Validar ambos campos
    const isNumeroValid = validateField(numeroInput);
    const isApellidoValid = validateField(apellidoInput);
    if (!isNumeroValid || !isApellidoValid) return;

    const submitBtn = forgotPasswordStep1.querySelector('button[type="submit"]');
    submitBtn.innerHTML = 'Procesando...';
    submitBtn.disabled = true;

    try {
      const formData = new FormData(forgotPasswordStep1);
      const data = Object.fromEntries(formData);

      const resp = await fetch('/auth/request-reset', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await resp.json();

      if (resp.ok && result.codigo) {
          // Éxito: Mostrar el código y avanzar al siguiente paso
        document.getElementById('recovery-code-display').textContent = result.codigo;
        forgotPasswordStep1.classList.add('hidden');
        forgotPasswordStep2.classList.remove('hidden');
      } else {
          // Error: Mostrar el mensaje de error del backend en el modal.
          // Esto previene la redirección por el interceptor en caso de 401.
          if (resp.status === 401) {
            console.warn("Error de credenciales (401) en recuperación de contraseña. Mostrando mensaje en modal.");
          }

        const errorMessage = result.error || "Error al procesar la solicitud.";
        msg.textContent = errorMessage;
        // Asegurarse de que el mensaje de error sea visible y tenga el color correcto.
        msg.classList.remove("hidden", "text-green-400");
        msg.classList.add("text-red-400");
      }
    } finally {
      submitBtn.innerHTML = 'Obtener Código';
      submitBtn.disabled = false;
    }
  };

  // Paso 3: Verificar el código
  forgotPasswordStep3.onsubmit = async function (e) {
      e.preventDefault();
      msg.classList.add("hidden");
      const codigoInput = document.getElementById('verify-code');
      if (!validateField(codigoInput)) return;

      const submitBtn = forgotPasswordStep3.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = 'Procesando...';
      submitBtn.disabled = true;

      try {
        const resp = await fetch('/auth/verify-reset-code', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo: codigoInput.value }),
        });
        const result = await resp.json();

        if (resp.ok && result.reset_token) {
          // El código es correcto. Ocultar paso 3 y mostrar paso 4.
          forgotPasswordStep3.classList.add('hidden');
          forgotPasswordStep4.classList.remove('hidden');
          
          // Guardar el token en el formulario del paso 4
          const tokenInput = document.getElementById('reset-token-input');
          tokenInput.value = result.reset_token;

        } else {
          msg.textContent = result.error || "Error al verificar el código.";
          msg.classList.remove("hidden", "text-green-400");
          msg.classList.add("text-red-400");
        }
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
  };

  // Paso 4: Enviar la nueva contraseña
  forgotPasswordStep4.onsubmit = async function (e) {
      e.preventDefault();
      msg.classList.add("hidden");

      const newPasswordInput = document.getElementById('reset-new-password');
      const confirmPasswordInput = document.getElementById('reset-confirm-password');
      const tokenInput = document.getElementById('reset-token-input');

      // Validar campos
      const isNewPasswordValid = validateField(newPasswordInput);
      const isConfirmPasswordValid = validateField(confirmPasswordInput);

      if (!isNewPasswordValid || !isConfirmPasswordValid) return;

      const submitBtn = forgotPasswordStep4.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = 'Procesando...';
      submitBtn.disabled = true;

      try {
          const resp = await fetch(`/auth/reset-password/${tokenInput.value}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                  contraseña: newPasswordInput.value,
                  confirm_contraseña: confirmPasswordInput.value
              }),
          });
          const result = await resp.json();

          if (resp.ok && result.success) {
              // MEJORA PROFESIONAL: No recargar la página.
              // Mostrar mensaje de éxito y cambiar a la vista de login.
              msg.textContent = "¡Contraseña actualizada! Ya puedes iniciar sesión.";
              msg.classList.remove("hidden", "text-red-400");
              msg.classList.add("text-green-400");

              // Después de un momento, cambiar a la vista de login.
              setTimeout(() => {
                  backToLoginLink.click(); // Simula el clic en "Volver a Iniciar Sesión"
                  msg.textContent = ""; // Limpia el mensaje para la nueva vista
              }, 2000);
          } else {
              msg.textContent = result.error || "Error al restablecer la contraseña.";
              msg.classList.remove("hidden", "text-green-400");
              msg.classList.add("text-red-400");
          }
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
  };

  // --- FIN: Manejo del nuevo flujo de contraseña olvidada ---

  // Setup forms
  handleSubmit(loginForm, "/auth/login");
  handleSubmit(registerForm, "/auth/register"); 
  // Configurar validación en tiempo real para los formularios de reseteo
  setupRealTimeValidation(forgotPasswordStep1);
  setupRealTimeValidation(forgotPasswordStep3);
  if (forgotPasswordStep4) setupRealTimeValidation(forgotPasswordStep4);

  // Enhanced password toggle
  function setupPasswordToggle(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);

    btn.addEventListener("click", function () {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";

      btn.innerHTML = isHidden
        ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>'
        : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';

      btn.setAttribute(
        "aria-label",
        isHidden ? "Ocultar contraseña" : "Mostrar contraseña"
      );
    });
  }

  setupPasswordToggle("login-password", "toggle-login-password");
  setupPasswordToggle("register-password", "toggle-register-password");
  setupPasswordToggle("reset-new-password", "toggle-reset-password");
  setupPasswordToggle("reset-confirm-password", "toggle-reset-confirm-password");

  // Close on escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !bg.classList.contains("hidden")) {
      closeModal();
    }
  });

  // MEJORA: Función para prevenir los mensajes de validación nativos del navegador
  // para el campo de contraseña de inicio de sesión.
  // Esto evita que el navegador muestre mensajes como "La contraseña debe tener X caracteres..."
  // y permite que el backend maneje el mensaje genérico de "credenciales inválidas".
  function preventLoginPasswordNativeValidationMessages() {
    const loginPasswordField = document.getElementById('login-password');
    if (loginPasswordField) {
      loginPasswordField.addEventListener('invalid', function(event) {
        event.preventDefault(); // Evita que el navegador muestre su mensaje de error predeterminado.
      });
    }
  }
  document.addEventListener('DOMContentLoaded', preventLoginPasswordNativeValidationMessages);
})();
