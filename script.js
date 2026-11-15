'use strict';

(() => {
  const BUSINESS_WHATSAPP_NUMBER = '916295594881';
  const SELECTORS = {
    menuToggle: '#menuToggle',
    navigation: '#primaryNavigation',
    bookingForm: '#rideForm',
    pickup: '#pickup',
    destination: '#destination',
    travelDate: '#travelDate',
    rideType: '#rideType',
    vehiclePreference: '#vehiclePreference',
    passengers: '#passengers',
    selectedPackage: '#selectedPackage',
    formStatus: '#formStatus',
    gallery: '#galleryGrid',
    galleryEmpty: '#galleryEmpty',
    lightbox: '#lightbox',
    lightboxImage: '#lightboxImage',
    lightboxClose: '#lightboxClose',
    currentYear: '#currentYear'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const elements = Object.fromEntries(
    Object.entries(SELECTORS).map(([key, selector]) => [key, $(selector)])
  );

  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  function initializeYear() {
    if (elements.currentYear) {
      elements.currentYear.textContent = String(new Date().getFullYear());
    }
  }

  function initializeMobileNavigation() {
    const { menuToggle, navigation } = elements;
    if (!menuToggle || !navigation) return;

    const setMenuOpen = (isOpen) => {
      navigation.classList.toggle('is-open', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    };

    menuToggle.addEventListener('click', () => {
      setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
    });

    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenuOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    });

    document.addEventListener('click', (event) => {
      const clickedInsideMenu = navigation.contains(event.target) || menuToggle.contains(event.target);
      if (!clickedInsideMenu) setMenuOpen(false);
    });
  }

  function initializeImageFallbacks() {
    const updateGalleryVisibility = () => {
      if (!elements.galleryEmpty || !elements.gallery) return;
      const visibleImages = $$('.gallery-item', elements.gallery).some((item) => !item.hidden);
      elements.galleryEmpty.hidden = visibleImages;
    };

    // Capture image errors so images inserted later by the CMS are handled too.
    document.addEventListener('error', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;

      const frame = image.closest('.image-frame');
      const galleryItem = image.closest('.gallery-item');

      if (frame) frame.classList.add('image-frame--missing');
      if (galleryItem) {
        galleryItem.hidden = true;
        updateGalleryVisibility();
      }
    }, true);

    $$('img').forEach((image) => {
      if (image.complete && image.naturalWidth === 0) {
        const frame = image.closest('.image-frame');
        const galleryItem = image.closest('.gallery-item');
        if (frame) frame.classList.add('image-frame--missing');
        if (galleryItem) galleryItem.hidden = true;
      }
    });

    updateGalleryVisibility();
  }

  function setFieldError(field, message) {
    if (!field) return false;
    const errorElement = $(`#${field.id}Error`);
    field.setAttribute('aria-invalid', String(Boolean(message)));
    if (errorElement) errorElement.textContent = message;
    return !message;
  }

  function validateBookingForm() {
    const { pickup, destination, travelDate } = elements;
    if (!pickup || !destination || !travelDate) return false;

    const pickupValue = pickup.value.trim();
    const destinationValue = destination.value.trim();
    const dateValue = travelDate.value;
    const today = getLocalDateString();

    const checks = [
      setFieldError(pickup, pickupValue ? '' : 'Enter your pickup location.'),
      setFieldError(destination, destinationValue ? '' : 'Enter your destination.'),
      setFieldError(
        travelDate,
        !dateValue ? 'Choose your travel date.' : dateValue < today ? 'Travel date cannot be in the past.' : ''
      )
    ];

    const firstInvalidField = [pickup, destination, travelDate].find(
      (field) => field.getAttribute('aria-invalid') === 'true'
    );

    if (firstInvalidField) firstInvalidField.focus();
    return checks.every(Boolean);
  }

  function createWhatsAppUrl(message) {
    return `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  function showWhatsAppFallback(url) {
    const status = elements.formStatus;
    if (!status) return;

    status.replaceChildren();
    status.append(document.createTextNode('Your trip details are ready. If WhatsApp did not open, '));

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'open WhatsApp manually';

    status.append(link, document.createTextNode('. Your ride is not booked until the business confirms it.'));
  }

  function handleBookingSubmit(event) {
    event.preventDefault();
    if (!validateBookingForm()) return;

    const {
      pickup, destination, travelDate, rideType, vehiclePreference, passengers, formStatus
    } = elements;

    const [year, month, day] = travelDate.value.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    const selectedPackage = elements.selectedPackage?.value;
    const message = [
      'Hello MAA KAMAKHYA TOUR & TRAVELS, I would like to enquire about a ride.',
      '',
      `Pickup: ${pickup.value.trim()}`,
      `Destination: ${destination.value.trim()}`,
      `Date: ${formattedDate}`,
      `Ride type: ${rideType.value}`,
      ...(selectedPackage ? [`Package: ${selectedPackage}`] : []),
      `Vehicle: ${vehiclePreference.value}`,
      `Passengers: ${passengers.value}`,
      '',
      'Please confirm availability and fare.'
    ].join('\n');

    const whatsappUrl = createWhatsAppUrl(message);
    const whatsappWindow = window.open(whatsappUrl, '_blank');

    if (whatsappWindow) {
      whatsappWindow.opener = null;
      formStatus.textContent = 'WhatsApp should now be open with your details. Review and send the message — your ride is not booked until the business confirms it.';
    } else {
      showWhatsAppFallback(whatsappUrl);
    }
  }

  function scrollToBooking() {
    const bookingSection = $('#book');
    if (!bookingSection) return;
    bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => elements.pickup?.focus({ preventScroll: true }), 450);
  }

  function initializeBookingForm() {
    const { bookingForm, travelDate } = elements;
    if (!bookingForm || !travelDate) return;

    travelDate.min = getLocalDateString();
    bookingForm.addEventListener('submit', handleBookingSubmit);

    [elements.pickup, elements.destination, travelDate].filter(Boolean).forEach((field) => {
      field.addEventListener('input', () => setFieldError(field, ''));
      field.addEventListener('change', () => setFieldError(field, ''));
    });

    // Event delegation supports package/offer buttons inserted asynchronously by cms.js.
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ride-type]');
      if (!button) return;

      elements.rideType.value = button.dataset.rideType;
      if (elements.selectedPackage) {
        elements.selectedPackage.value = button.dataset.package || '';
      }
      scrollToBooking();
    });

    $$('[data-vehicle]').forEach((button) => {
      button.addEventListener('click', () => {
        const requestedVehicle = button.dataset.vehicle;
        const matchingOption = Array.from(elements.vehiclePreference.options).find(
          (option) => option.value.toLowerCase() === requestedVehicle.toLowerCase()
        );
        elements.vehiclePreference.value = matchingOption ? matchingOption.value : 'Recommend a vehicle';
        scrollToBooking();
      });
    });
  }

  function initializeLightbox() {
    const { gallery, lightbox, lightboxImage, lightboxClose } = elements;
    if (!gallery || !lightbox || !lightboxImage || !lightboxClose) return;

    let previouslyFocusedElement = null;

    const closeLightbox = () => {
      lightbox.hidden = true;
      lightboxImage.removeAttribute('src');
      if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus();
    };

    // Delegation supports gallery images rendered later by the CMS.
    gallery.addEventListener('click', (event) => {
      const galleryButton = event.target.closest('[data-gallery-image]');
      if (!galleryButton || galleryButton.hidden) return;

      const image = $('img', galleryButton);
      if (!image) return;

      previouslyFocusedElement = galleryButton;
      lightboxImage.src = galleryButton.dataset.galleryImage;
      lightboxImage.alt = image.alt;
      lightbox.hidden = false;
      lightboxClose.focus();
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
  }

  function initialize() {
    initializeYear();
    initializeMobileNavigation();
    initializeImageFallbacks();
    initializeBookingForm();
    initializeLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
