const site = window.ABC_SITE || { tutors: [] };
const telemetry = window.ABC_TELEMETRY || { capture: () => {} };
const track = (eventName, properties = {}) => telemetry.capture(eventName, properties);

// Prototype booking persistence. Store only tutor/slot metadata — never parent or student form values.
const PROTOTYPE_BOOKINGS_KEY = 'abcTutoringPrototypeBookingsV1';
let serverBookedSlots = new Set();

function bookingSlotKey(tutorId, slotValue) {
  return `${tutorId}::${slotValue}`;
}

async function syncServerAvailability() {
  if (!site.bookingEndpoint) return;
  try {
    const response = await fetch('/api/availability', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('availability_failed');
    const payload = await response.json();
    serverBookedSlots = new Set((payload.booked || []).map(item => bookingSlotKey(item.tutor_id, item.slot_id)));
  } catch (error) {
    console.warn('Could not refresh shared booking availability.', error);
  }
}

function getPrototypeBookings() {
  if (!site.prototypeMode) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROTOTYPE_BOOKINGS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function isPrototypeSlotBooked(tutorId, slotValue) {
  return getPrototypeBookings().some(booking =>
    booking && booking.tutor_id === tutorId && booking.slot_id === slotValue
  );
}

function getAvailableSlots(tutor) {
  const slots = tutor?.availability || [];
  if (site.bookingEndpoint) {
    return slots.filter(slot => !serverBookedSlots.has(bookingSlotKey(tutor.id, slot.value)));
  }
  if (!site.prototypeMode) return slots;
  return slots.filter(slot => !isPrototypeSlotBooked(tutor.id, slot.value));
}

function reservePrototypeSlot(tutor, slot) {
  if (!site.prototypeMode || !tutor || !slot) return false;
  const bookings = getPrototypeBookings();
  if (bookings.some(booking => booking.tutor_id === tutor.id && booking.slot_id === slot.value)) {
    return false;
  }
  bookings.push({
    tutor_id: tutor.id,
    slot_id: slot.value,
    booked_at: new Date().toISOString()
  });
  localStorage.setItem(PROTOTYPE_BOOKINGS_KEY, JSON.stringify(bookings));
  return true;
}

function clearPrototypeBookings() {
  localStorage.removeItem(PROTOTYPE_BOOKINGS_KEY);
}

const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');
if (menuBtn && navLinks) {
  menuBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// Facebook links stay intentionally disabled until the owner supplies the exact page URL.
document.querySelectorAll('[data-facebook]').forEach(link => {
  if (site.facebookUrl) {
    link.href = site.facebookUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => track('facebook clicked', { location: link.closest('header') ? 'header' : 'page' }));
  } else {
    link.href = '#';
    link.classList.add('link-disabled');
    link.setAttribute('aria-disabled', 'true');
    link.title = 'Add the ABC Tutoring Facebook page URL in js/site-data.js before launch.';
    link.addEventListener('click', e => {
      e.preventDefault();
      track('facebook unavailable clicked', { location: link.closest('header') ? 'header' : 'page' });
    });
  }
});

function rateText(tutor) {
  if (!tutor.rate) return 'Individual rate to be added';
  return `${tutor.rateIsDemo ? 'Demo rate · ' : ''}$${tutor.rate} / hour`;
}

function availabilityMarkup(tutor) {
  const postedSlots = tutor.availability || [];
  const availableSlots = getAvailableSlots(tutor);
  if (!postedSlots.length) {
    return '<p class="availability-empty">Current weekly openings will appear here once they are posted.</p>';
  }
  if (!availableSlots.length) {
    return '<p class="availability-empty"><strong>All posted openings are booked.</strong><br><small>Prototype bookings persist in this browser until reset.</small></p>';
  }
  const demo = tutor.availabilityIsDemo ? '<p class="demo-label">Prototype availability</p>' : '';
  return `${demo}<ul class="availability-list">${availableSlots.slice(0, 4).map(slot =>
    `<li><span>${slot.label}</span>${slot.format ? `<small>${slot.format}</small>` : ''}</li>`
  ).join('')}</ul>`;
}

const tutorGrid = document.querySelector('#tutorGrid');
function renderTutorGrid() {
  if (!tutorGrid) return;
  tutorGrid.innerHTML = site.tutors.map(tutor => `
    <article class="card tutor-card" data-subject="${tutor.subjectKey}">
      <img class="tutor-photo" src="${tutor.photo}" alt="Photo placeholder for ${tutor.name}">
      <div class="tutor-card-body">
        <div class="tutor-topline"><div><h3>${tutor.name}</h3><div class="meta">${tutor.subject}</div></div><div class="price">${rateText(tutor)}</div></div>
        <div class="tags">${tutor.specialties.map(s => `<span class="tag">${s}</span>`).join('')}</div>
        <div class="availability-block"><h4>Current availability</h4>${availabilityMarkup(tutor)}</div>
        <a class="btn btn-primary" data-tutor-book="${tutor.id}" href="booking.html?tutor=${encodeURIComponent(tutor.id)}">View times & book</a>
      </div>
    </article>`).join('');

  tutorGrid.querySelectorAll('[data-tutor-book]').forEach(link => {
    link.addEventListener('click', () => {
      const tutor = site.tutors.find(t => t.id === link.dataset.tutorBook);
      if (!tutor) return;
      track('tutor booking clicked', {
        tutor_id: tutor.id,
        subject_key: tutor.subjectKey,
        hourly_rate: tutor.rate,
        availability_count: getAvailableSlots(tutor).length,
        prototype_data: Boolean(site.prototypeMode)
      });
    });
  });
}
renderTutorGrid();

if (tutorGrid) {
  tutorGrid.addEventListener('abc:refresh-tutors', () => {
    // Re-render the current page so booked slots disappear from tutor cards immediately.
    window.location.reload();
  });
}

const resetPrototypeBookingsButton = document.querySelector('#resetPrototypeBookings');
if (resetPrototypeBookingsButton && site.prototypeMode && !site.bookingEndpoint) {
  resetPrototypeBookingsButton.hidden = false;
  resetPrototypeBookingsButton.addEventListener('click', () => {
    clearPrototypeBookings();
    track('prototype bookings reset', { prototype_data: true });
    window.location.reload();
  });
}

const tutorFilter = document.querySelector('#subjectFilter');
if (tutorFilter) {
  tutorFilter.addEventListener('change', () => {
    const value = tutorFilter.value;
    document.querySelectorAll('.tutor-card').forEach(card => {
      card.style.display = value === 'all' || card.dataset.subject === value ? '' : 'none';
    });
    track('tutor filter changed', { subject_filter: value });
  });
}

const tutorSelect = document.querySelector('#tutor');
const slotSelect = document.querySelector('#slot');
const subjectSelect = document.querySelector('#subject');
const rateSummary = document.querySelector('#selectedRate');
const sessionSummary = document.querySelector('#sessionSummary');
const bookingButton = document.querySelector('#bookingButton');

function populateTutors() {
  if (!tutorSelect) return;
  site.tutors.forEach(tutor => {
    const option = document.createElement('option');
    option.value = tutor.id;
    option.textContent = `${tutor.name} — ${tutor.subject}`;
    tutorSelect.appendChild(option);
  });

  const params = new URLSearchParams(window.location.search);
  const requestedTutor = params.get('tutor');
  if (requestedTutor && site.tutors.some(t => t.id === requestedTutor)) {
    tutorSelect.value = requestedTutor;
  }
  refreshSlots(false);
}

function refreshSlots(shouldTrack = true) {
  if (!tutorSelect || !slotSelect) return;
  const tutor = site.tutors.find(t => t.id === tutorSelect.value);
  const availableSlots = getAvailableSlots(tutor);
  slotSelect.innerHTML = '<option value="">Select an available time</option>';
  if (!tutor) {
    slotSelect.disabled = true;
    if (rateSummary) rateSummary.textContent = 'Choose a tutor to see their rate.';
    if (sessionSummary) sessionSummary.textContent = 'Sessions are generally one student at a time and last one hour.';
    if (bookingButton) bookingButton.disabled = true;
    return;
  }

  if (shouldTrack) {
    track('booking tutor selected', {
      tutor_id: tutor.id,
      subject_key: tutor.subjectKey,
      hourly_rate: tutor.rate,
      availability_count: availableSlots.length,
      prototype_data: Boolean(site.prototypeMode)
    });
  }

  if (rateSummary) rateSummary.textContent = tutor.rate ? `${tutor.rateIsDemo ? 'Prototype rate: ' : ''}$${tutor.rate} per 60-minute session` : 'This tutor’s hourly rate needs to be added before launch.';
  if (subjectSelect) {
    if (tutor.subjectKey === 'science') subjectSelect.value = 'Science';
    else if (tutor.subjectKey === 'reading') subjectSelect.value = 'Elementary Reading';
  }

  if (availableSlots.length) {
    availableSlots.forEach((slot, index) => {
      const option = document.createElement('option');
      option.value = slot.value;
      option.dataset.slotIndex = String(index);
      option.dataset.format = slot.format || '';
      option.textContent = `${slot.label}${slot.format ? ` · ${slot.format}` : ''}${tutor.availabilityIsDemo ? ' · DEMO' : ''}`;
      slotSelect.appendChild(option);
    });
    slotSelect.disabled = false;
    if (bookingButton) bookingButton.disabled = false;
    if (sessionSummary) sessionSummary.textContent = `${availableSlots.length} ${tutor.availabilityIsDemo ? 'prototype opening' : 'current opening'}${availableSlots.length === 1 ? '' : 's'} available for this tutor.`;
  } else {
    slotSelect.disabled = true;
    if (bookingButton) bookingButton.disabled = true;
    if (sessionSummary) sessionSummary.textContent = tutor.availability?.length ? 'All posted openings are currently booked in this browser.' : 'No weekly openings have been posted for this tutor yet.';
    track('booking availability unavailable', { tutor_id: tutor.id, subject_key: tutor.subjectKey, all_posted_slots_booked: Boolean(tutor.availability?.length) });
  }
}

if (tutorSelect) {
  populateTutors();
  tutorSelect.addEventListener('change', () => refreshSlots(true));
}

if (slotSelect) {
  slotSelect.addEventListener('change', () => {
    if (!slotSelect.value) return;
    const selected = slotSelect.options[slotSelect.selectedIndex];
    const formatSelect = document.querySelector('#format');
    if (formatSelect && selected.dataset.format) formatSelect.value = selected.dataset.format;
    track('booking slot selected', {
      tutor_id: tutorSelect?.value || '',
      slot_id: slotSelect.value,
      slot_index: Number(selected.dataset.slotIndex || 0),
      session_format: selected.dataset.format || 'unspecified',
      prototype_data: Boolean(site.prototypeMode)
    });
  });
}

const bookingForm = document.querySelector('#bookingForm');
if (bookingForm) {
  let formStarted = false;
  bookingForm.addEventListener('focusin', () => {
    if (formStarted) return;
    formStarted = true;
    track('booking form started', {
      tutor_id: tutorSelect?.value || 'not_selected',
      entry_from_tutor: new URLSearchParams(window.location.search).has('tutor'),
      prototype_data: Boolean(site.prototypeMode)
    });
  });

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const notice = document.querySelector('#bookingNotice');
    const submitter = bookingForm.querySelector('button[type="submit"]');
    const tutor = site.tutors.find(t => t.id === tutorSelect?.value);
    const selectedSlot = slotSelect?.options[slotSelect.selectedIndex];
    const safeProps = {
      tutor_id: tutor?.id || 'unknown',
      subject_key: tutor?.subjectKey || 'unknown',
      hourly_rate: tutor?.rate || null,
      slot_id: slotSelect?.value || 'unknown',
      session_format: selectedSlot?.dataset.format || document.querySelector('#format')?.value || 'unspecified',
      prototype_data: Boolean(site.prototypeMode)
    };
    track('booking attempted', safeProps);

    // Study prototype mode: reserve the selected opening in this browser so the UI updates after booking.
    if (!site.bookingEndpoint && site.prototypeMode) {
      const slot = tutor?.availability?.find(item => item.value === slotSelect?.value);
      if (!tutor || !slot || !reservePrototypeSlot(tutor, slot)) {
        if (notice) {
          notice.className = 'notice notice-warning';
          notice.style.display = 'block';
          notice.textContent = 'That opening is no longer available. Please choose another time.';
        }
        track('booking failed', { ...safeProps, reason: 'slot_already_booked' });
        refreshSlots(false);
        return;
      }

      const remaining = getAvailableSlots(tutor).length;
      if (notice) {
        notice.className = 'notice';
        notice.style.display = 'block';
        notice.textContent = `Booking confirmed for the study prototype. ${slot.label} is now reserved in this browser and no longer appears as available.`;
      }
      track('booking completed', {
        ...safeProps,
        remaining_availability: remaining,
        persistence: 'localStorage'
      });
      bookingForm.reset();
      tutorSelect.value = tutor.id;
      refreshSlots(false);
      if (tutorGrid) tutorGrid.dispatchEvent(new CustomEvent('abc:refresh-tutors'));
      return;
    }

    if (!site.bookingEndpoint) {
      if (notice) {
        notice.className = 'notice notice-warning';
        notice.style.display = 'block';
        notice.textContent = 'The booking flow is ready, but live submission is not connected yet. Add a secure booking/form endpoint in js/site-data.js so bookings can be recorded and the owner can receive email or text notifications.';
      }
      track('booking blocked', { ...safeProps, reason: 'booking_endpoint_not_configured' });
      return;
    }

    try {
      submitter.disabled = true;
      const response = await fetch(site.bookingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(bookingForm).entries()))
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 409 || result.code === 'slot_booked') {
        await syncServerAvailability();
        renderTutorGrid();
        refreshSlots(false);
        if (notice) {
          notice.className = 'notice notice-warning';
          notice.style.display = 'block';
          notice.textContent = result.error || 'That opening was just booked. Please choose another time.';
        }
        track('booking failed', { ...safeProps, reason: 'slot_already_booked' });
        return;
      }
      if (!response.ok) throw new Error(result.error || 'Submission failed');

      await syncServerAvailability();
      renderTutorGrid();
      const ownerNotificationAttempted = Array.isArray(result.notification) && result.notification.some(item => item.attempted);
      if (notice) {
        notice.className = 'notice';
        notice.style.display = 'block';
        notice.textContent = ownerNotificationAttempted
          ? 'Booking confirmed. That tutor/time is now unavailable to other visitors, and the owner notification was sent through the configured channel.'
          : 'Booking confirmed and the tutor/time is now unavailable to other visitors. This study server has not been given Dana’s email/SMS provider credentials yet, so the notification is previewed in the server terminal instead.';
      }
      track('booking completed', {
        ...safeProps,
        persistence: 'server',
        owner_notification_attempted: ownerNotificationAttempted
      });
      bookingForm.reset();
      tutorSelect.value = tutor?.id || '';
      refreshSlots(false);
    } catch (error) {
      if (notice) {
        notice.className = 'notice notice-warning';
        notice.style.display = 'block';
        notice.textContent = 'We could not submit the booking. Please try again.';
      }
      track('booking failed', { ...safeProps, reason: 'endpoint_error' });
    } finally {
      submitter.disabled = false;
    }
  });
}

if (site.bookingEndpoint) {
  syncServerAvailability().then(() => {
    renderTutorGrid();
    refreshSlots(false);
  });
}
