/**
 * Dr. Nihan Sert - Dentist Website Interactive Controller
 * Features: Form validation, Booking state management, About modal overlays.
 * No emojis. No gradients. Clean custom JS.
 */

// Google Apps Script Web App URL (Buraya kendi Web App URL'nizi yapıştırın)
// Boş bırakılırsa sistem otomatik olarak Simülasyon modunda çalışır.
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwyX0h3ez9_PS1I6hXbzLBbS3eacYSC6LJg0L51vfkCHsO65bQU-Wg6LSQpjpjP0ks/exec';

// Klinik Çalışma Saatleri (Takvimde listelenecek saatler)
const CLINIC_HOURS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

// Dolu olan randevu saatlerinin tutulacağı hafıza listesi
let busyAppointments = [];

document.addEventListener('DOMContentLoaded', async () => {
    initAboutModal();
    initCarousel();
    await loadAppointments();  // Önce dolu randevuları çek, sonra formu hazırla
    initAppointmentForm();
});

/**
 * Google Drive (Google Sheets) üzerinden dolu randevu saatlerini çeker
 */
async function loadAppointments() {
    if (!GOOGLE_SCRIPT_URL) {
        // Simülasyon Modu: Bugün ve yarın için bazı örnek randevular dolduralım
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formatStr = (d) => d.toISOString().split('T')[0];

        busyAppointments = [
            `${formatStr(today)} 10:00`,
            `${formatStr(today)} 14:00`,
            `${formatStr(tomorrow)} 11:00`,
            `${formatStr(tomorrow)} 15:00`,
            `${formatStr(tomorrow)} 16:00`
        ];
        console.log('Simülasyon Modu: Dolu randevular yüklendi:', busyAppointments);
        return;
    }

    try {
        // Google Script API'sine GET isteği atılıyor
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        if (data && data.busySlots) {
            busyAppointments = data.busySlots;
            console.log('Google Sheets randevu saatleri güncellendi:', busyAppointments);
        }
    } catch (error) {
        console.error('Randevular çekilirken hata oluştu, yerel modda devam ediliyor:', error);
    }
}

/**
 * About Modal Functionality
 * Opens a modal drawer for "Hakkımızda" link and handles backdrop/esc key closures.
 */
function initAboutModal() {
    const aboutLink = document.getElementById('about-link');
    const modal = document.getElementById('about-modal');
    const closeBtn = document.getElementById('modal-close');

    if (!aboutLink || !modal || !closeBtn) return;

    // Helper: Open Modal
    const openModal = () => {
        modal.style.display = 'flex';
        // Trigger browser reflow to enable CSS transition
        modal.offsetHeight;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        closeBtn.focus();
    };

    // Helper: Close Modal
    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; // Restore scrolling
        aboutLink.focus();
        
        // Hide from layout tree after transition finishes
        setTimeout(() => {
            if (!modal.classList.contains('is-open')) {
                modal.style.display = 'none';
            }
        }, 400); // matches --transition-smooth (0.4s)
    };

    // Event Listeners
    aboutLink.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });

    closeBtn.addEventListener('click', closeModal);

    // Close when clicking on overlay backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close on Escape key press
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) {
            closeModal();
        }
    });
}

/**
 * Appointment Booking Form Management
 * Validates fields dynamically, handles custom errors, and handles successful bookings.
 */
function initAppointmentForm() {
    const form = document.getElementById('appointment-form');
    const successContainer = document.getElementById('form-success');
    const resetBtn = document.getElementById('btn-reset-form');

    if (!form || !successContainer || !resetBtn) return;

    // Initialize phone input mask and prefix
    initPhoneMask();

    // Set minimum date picker target to today to prevent past dates
    const dateInput = document.getElementById('form-date');
    const timeSelect = document.getElementById('form-time');

    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);

        // Helper: check if a date is fully booked (all clinic hours taken)
        const isDateFullyBooked = (dateStr) => {
            return CLINIC_HOURS.every(hour => busyAppointments.includes(`${dateStr} ${hour}`));
        };

        // Helper: find the "fully booked" warning span next to the date input
        const getDateWarning = () => document.getElementById('date-fully-booked-warning');

        // Date selection dynamic change listener
        dateInput.addEventListener('change', () => {
            const selectedDate = dateInput.value;

            // Remove previous warning
            const existingWarning = getDateWarning();
            if (existingWarning) existingWarning.remove();

            if (!selectedDate) {
                if (timeSelect) {
                    timeSelect.disabled = true;
                    timeSelect.innerHTML = '<option value="" disabled selected>Önce tarih seçiniz</option>';
                }
                return;
            }

            // Check if the whole day is fully booked
            if (isDateFullyBooked(selectedDate)) {
                // Show inline warning under the date picker
                const warning = document.createElement('span');
                warning.id = 'date-fully-booked-warning';
                warning.className = 'error-message';
                warning.style.display = 'block';
                warning.textContent = 'Bu tarih için tüm saatler dolmuştur. Lütfen başka bir gün seçin.';
                dateInput.parentNode.appendChild(warning);

                if (timeSelect) {
                    timeSelect.disabled = true;
                    timeSelect.innerHTML = '<option value="" disabled selected>Bu gün için boş saat kalmadı</option>';
                }
                return;
            }

            if (timeSelect) {
                timeSelect.disabled = false;
                timeSelect.innerHTML = '<option value="" disabled selected>Saat seçiniz</option>';

                let availableSlotsCount = 0;
                CLINIC_HOURS.forEach(hour => {
                    const dateTimeString = `${selectedDate} ${hour}`;
                    if (!busyAppointments.includes(dateTimeString)) {
                        const opt = document.createElement('option');
                        opt.value = hour;
                        opt.textContent = hour;
                        timeSelect.appendChild(opt);
                        availableSlotsCount++;
                    }
                });

                if (availableSlotsCount === 0) {
                    timeSelect.disabled = true;
                    timeSelect.innerHTML = '<option value="" disabled selected>Bu gün için boş saat kalmadı</option>';
                }

                // Trigger validation state update
                validateField(timeSelect);
            }
        });
    }

    // Helper: Show error on a form group
    const showError = (inputElement) => {
        const group = inputElement.closest('.form-group');
        if (group) {
            group.classList.add('is-invalid');
        }
    };

    // Helper: Clear error on a form group
    const clearError = (inputElement) => {
        const group = inputElement.closest('.form-group');
        if (group) {
            group.classList.remove('is-invalid');
        }
    };

    // Helper: Validate email structure
    const isValidEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    // Helper: Validate phone number format (must have 10 digits after +90)
    const isValidPhone = (phone) => {
        const digits = phone.replace(/\D/g, '');
        return digits.length === 12 && digits.startsWith('90');
    };

    // Validate a single input field
    const validateField = (input) => {
        const value = input.value.trim();

        // Check required
        if (input.hasAttribute('required') && !value) {
            showError(input);
            return false;
        }

        // Check specific types
        if (input.type === 'email' && value) {
            if (!isValidEmail(value)) {
                showError(input);
                return false;
            }
        }

        if (input.type === 'tel' && value) {
            if (!isValidPhone(value)) {
                showError(input);
                return false;
            }
        }

        // Validate select element explicitly
        if (input.tagName === 'SELECT' && (!value || value === '')) {
            showError(input);
            return false;
        }

        // Validate date
        if (input.id === 'form-date' && value) {
            const selectedDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // normalize time
            if (selectedDate < today) {
                showError(input);
                return false;
            }
        }

        clearError(input);
        return true;
    };

    // Validate all fields inside the form
    const validateForm = () => {
        let isFormValid = true;
        const inputs = form.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            // Skip optional fields if they are empty
            if (!input.hasAttribute('required') && !input.value.trim()) {
                clearError(input);
                return;
            }

            const isFieldValid = validateField(input);
            if (!isFieldValid) {
                isFormValid = false;
            }
        });

        return isFormValid;
    };

    // Real-time input checking after dynamic interactions
    form.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('input', () => {
            if (input.closest('.form-group').classList.contains('is-invalid')) {
                validateField(input);
            }
        });

        input.addEventListener('blur', () => {
            validateField(input);
        });

        if (input.tagName === 'SELECT') {
            input.addEventListener('change', () => {
                validateField(input);
            });
        }
    });

    // Form submission event
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const isValid = validateForm();

        if (isValid) {
            // Extract values
            const formData = {
                name: document.getElementById('form-name').value.trim(),
                phone: document.getElementById('form-phone').value.trim(),
                email: document.getElementById('form-email').value.trim(),
                date: dateInput.value,
                time: timeSelect.value,
                notes: document.getElementById('form-notes').value.trim()
            };

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Gönderiliyor...';
            submitBtn.disabled = true;

            const handleSuccess = () => {
                // local booking memory update so slot gets immediately hidden
                const bookedDateTime = `${formData.date} ${formData.time}`;
                busyAppointments.push(bookedDateTime);

                // Display visual success card overlay
                successContainer.classList.add('is-active');

                // Reset form inputs
                form.reset();
                if (timeSelect) {
                    timeSelect.disabled = true;
                    timeSelect.innerHTML = '<option value="" disabled selected>Önce tarih seçiniz</option>';
                }
            };

            if (!GOOGLE_SCRIPT_URL) {
                // Simulation Mode latency
                setTimeout(() => {
                    console.log('Simulation: Booking saved to Drive:', formData);
                    handleSuccess();
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                }, 1000);
            } else {
                // Post data to Google Apps Script Web App
                fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: JSON.stringify(formData)
                })
                    .then(response => response.json())
                    .then(result => {
                        if (result.status === 'success') {
                            console.log('Google Sheets: Booking sent successfully:', formData);
                            handleSuccess();
                        } else if (result.status === 'busy') {
                            alert('Seçtiğiniz randevu saati az önce başka bir hasta tarafından rezerve edildi. Lütfen başka bir saat seçin.');
                            loadAppointments().then(() => {
                                if (dateInput) {
                                    dateInput.dispatchEvent(new Event('change'));
                                }
                            });
                        } else {
                            alert('Hata: ' + result.message);
                        }
                    })
                    .catch(error => {
                        console.error('Randevu iletilirken hata oluştu:', error);
                        // Fallback: Apps Script sometimes executes successfully but fails to return JSON under CORS redirects.
                        // We will treat it as success if we received a response, but here we assume general network/cors error.
                        alert('Randevu iletilirken bağlantı hatası oluştu. Lütfen e-tablonuzu kontrol edin.');
                    })
                    .finally(() => {
                        submitBtn.textContent = originalBtnText;
                        submitBtn.disabled = false;
                    });
            }

        } else {
            // Find first error and scroll to it gently
            const firstError = form.querySelector('.form-group.is-invalid');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });

    // Handle Reset Button on Success State
    resetBtn.addEventListener('click', () => {
        successContainer.classList.remove('is-active');
        // Reset min date
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.setAttribute('min', today);
        }
        // Lock time select
        if (timeSelect) {
            timeSelect.disabled = true;
            timeSelect.innerHTML = '<option value="" disabled selected>Önce tarih seçiniz</option>';
        }
    });
}

/**
 * Phone Number Formatting Mask
 * Forces "+90 " prefix, allows only digits after it, and dynamically formats as "+90 5XX XXX XX XX".
 */
function initPhoneMask() {
    const phoneInput = document.getElementById('form-phone');
    if (!phoneInput) return;

    // Helper: format raw digits to +90 5XX XXX XX XX
    const formatPhone = (value) => {
        // Strip non-digits
        let digits = value.replace(/\D/g, '');

        // If it starts with 90, strip the leading 90 since we prepend +90 manually
        if (digits.startsWith('90')) {
            digits = digits.slice(2);
        }

        // If it starts with 0 (like 05XX...), strip the leading 0
        if (digits.startsWith('0')) {
            digits = digits.slice(1);
        }

        // Standard formatting structure
        let formatted = '+90 ';
        
        if (digits.length > 0) {
            formatted += digits.substring(0, 3); // 5XX
        }
        if (digits.length > 3) {
            formatted += ' ' + digits.substring(3, 6); // XXX
        }
        if (digits.length > 6) {
            formatted += ' ' + digits.substring(6, 8); // XX
        }
        if (digits.length > 8) {
            formatted += ' ' + digits.substring(8, 10); // XX
        }

        return formatted;
    };

    // Initialize value
    if (!phoneInput.value || phoneInput.value.trim() === '' || phoneInput.value === '+90') {
        phoneInput.value = '+90 ';
    }

    phoneInput.addEventListener('input', (e) => {
        const cursorPosition = phoneInput.selectionStart;
        const previousLength = phoneInput.value.length;
        
        // Format the input
        let formatted = formatPhone(phoneInput.value);
        phoneInput.value = formatted;
        
        // Restore cursor position logically
        const lengthDiff = formatted.length - previousLength;
        let newCursorPos = cursorPosition + lengthDiff;
        
        // Prevent cursor from going before +90 space
        if (newCursorPos < 5) {
            newCursorPos = 5;
        }
        phoneInput.setSelectionRange(newCursorPos, newCursorPos);
    });



    phoneInput.addEventListener('focus', () => {
        if (!phoneInput.value || phoneInput.value === '') {
            phoneInput.value = '+90 ';
        }
    });
}

/**
 * Image Carousel Controller
 * Manages slider navigation (arrows, dot indicators) and touch swipes for mobile.
 */
function initCarousel() {
    const track = document.querySelector('.carousel-track');
    const slides = document.querySelectorAll('.carousel-slide');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const dots = document.querySelectorAll('.indicator-dot');

    if (!track || slides.length === 0 || !prevBtn || !nextBtn) return;

    const totalSlides = slides.length;

    // Dynamic cloning for infinite scrolling
    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[slides.length - 1].cloneNode(true);

    track.appendChild(firstClone);
    track.insertBefore(lastClone, slides[0]);

    // Due to prepended lastClone, the actual first slide starts at index 1
    let currentIndex = 1;
    let isTransitioning = false;

    // Set initial position without animation
    track.style.transition = 'none';
    track.style.transform = `translateX(-100%)`;

    // Helper: Go to slide index (1 to totalSlides)
    const goToSlide = (index, animate = true) => {
        if (isTransitioning && animate) return;

        isTransitioning = animate;
        currentIndex = index;

        if (!animate) {
            track.style.transition = 'none';
        } else {
            // Restore smooth transition
            track.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        }

        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        // Update dot indicators
        let activeDot = currentIndex - 1;
        if (activeDot < 0) activeDot = totalSlides - 1;
        if (activeDot >= totalSlides) activeDot = 0;

        dots.forEach((dot, dotIndex) => {
            if (dotIndex === activeDot) {
                dot.classList.add('is-active');
            } else {
                dot.classList.remove('is-active');
            }
        });
    };

    // Transitionend listener to handle infinite loop jump
    track.addEventListener('transitionend', () => {
        isTransitioning = false;

        // If we landed on firstClone (end of track) -> Jump instantly to original slide 1
        if (currentIndex === totalSlides + 1) {
            goToSlide(1, false);
        }
        // If we landed on lastClone (start of track) -> Jump instantly to original last slide
        if (currentIndex === 0) {
            goToSlide(totalSlides, false);
        }
    });

    // Button controls
    prevBtn.addEventListener('click', () => {
        if (isTransitioning) return;
        goToSlide(currentIndex - 1);
    });

    nextBtn.addEventListener('click', () => {
        if (isTransitioning) return;
        goToSlide(currentIndex + 1);
    });

    // Indicator Dot controls
    dots.forEach((dot, dotIndex) => {
        dot.addEventListener('click', () => {
            if (isTransitioning) return;
            goToSlide(dotIndex + 1);
        });
    });

    // Touch Swipe Support for Mobile Devices
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    const handleSwipe = () => {
        if (isTransitioning) return;
        const swipeDistance = touchEndX - touchStartX;
        const minSwipeThreshold = 50; // pixels

        if (swipeDistance < -minSwipeThreshold) {
            goToSlide(currentIndex + 1);
        } else if (swipeDistance > minSwipeThreshold) {
            goToSlide(currentIndex - 1);
        }
    };
}
