// ABC Tutoring content that changes most often.
// IMPORTANT: This study build uses clearly marked DEMO rates and weekly times so the booking flow can be tested end-to-end.
// Replace tutor names/photos/rates and availability with owner-provided data before any real launch.

window.ABC_SITE = {
  prototypeMode: true,
  facebookUrl: "", // Paste the full ABC Tutoring Facebook page URL here.
  bookingEndpoint: "/api/bookings", // Server-backed study booking endpoint.
  sessionLengthMinutes: 60,
  posthog: {
    enabled: true,
    projectToken: "phc_pkvFam3yUthwZVY9DqmNaCzM6bLtod6ypsmJPwKzJDV2",
    apiHost: "https://us.i.posthog.com",
    debug: false
  },
  tutors: [
    {
      id: "math-1",
      name: "Math Tutor 1",
      subjectKey: "math",
      subject: "Math",
      specialties: ["Elementary Math", "Middle School Math", "Algebra"],
      rate: 45,
      rateIsDemo: true,
      photo: "images/tutor-photo-placeholder.svg",
      availabilityIsDemo: true,
      availability: [
        { value: "demo-math-1-tue-1600", label: "Tuesday · 4:00 PM", format: "Online" },
        { value: "demo-math-1-thu-1730", label: "Thursday · 5:30 PM", format: "In person" }
      ]
    },
    {
      id: "math-2",
      name: "Math Tutor 2",
      subjectKey: "math",
      subject: "Math",
      specialties: ["Elementary Math", "Middle School Math", "Pre-Algebra"],
      rate: 50,
      rateIsDemo: true,
      photo: "images/tutor-photo-placeholder.svg",
      availabilityIsDemo: true,
      availability: [
        { value: "demo-math-2-mon-1630", label: "Monday · 4:30 PM", format: "Online" },
        { value: "demo-math-2-wed-1800", label: "Wednesday · 6:00 PM", format: "Online" }
      ]
    },
    {
      id: "math-3",
      name: "Math Tutor 3",
      subjectKey: "math",
      subject: "Math",
      specialties: ["Middle School Math", "Algebra I", "Algebra II"],
      rate: 55,
      rateIsDemo: true,
      photo: "images/tutor-photo-placeholder.svg",
      availabilityIsDemo: true,
      availability: [
        { value: "demo-math-3-tue-1800", label: "Tuesday · 6:00 PM", format: "In person" },
        { value: "demo-math-3-sat-1000", label: "Saturday · 10:00 AM", format: "Online" }
      ]
    },
    {
      id: "math-4",
      name: "Math Tutor 4",
      subjectKey: "math",
      subject: "Math",
      specialties: ["Middle School Math", "Algebra I", "Algebra II"],
      rate: 40,
      rateIsDemo: true,
      photo: "images/tutor-photo-placeholder.svg",
      availabilityIsDemo: true,
      availability: [
        { value: "demo-math-4-wed-1530", label: "Wednesday · 3:30 PM", format: "In person" },
        { value: "demo-math-4-fri-1700", label: "Friday · 5:00 PM", format: "Online" }
      ]
    },
    {
      id: "science-1",
      name: "Science Tutor",
      subjectKey: "science",
      subject: "Science",
      specialties: ["Science", "K–12 Support"],
      rate: 50,
      rateIsDemo: true,
      photo: "images/tutor-photo-placeholder.svg",
      availabilityIsDemo: true,
      availability: [
        { value: "demo-science-1-mon-1800", label: "Monday · 6:00 PM", format: "Online" },
        { value: "demo-science-1-thu-1600", label: "Thursday · 4:00 PM", format: "In person" }
      ]
    },
    {
      id: "reading-1",
      name: "Reading Tutor",
      subjectKey: "reading",
      subject: "Elementary Reading",
      specialties: ["Elementary Reading", "Comprehension", "Foundational Skills"],
      rate: 45,
      rateIsDemo: true,
      photo: "images/tutor-photo-placeholder.svg",
      availabilityIsDemo: true,
      availability: [
        { value: "demo-reading-1-tue-1530", label: "Tuesday · 3:30 PM", format: "In person" },
        { value: "demo-reading-1-sat-1100", label: "Saturday · 11:00 AM", format: "Online" }
      ]
    }
  ]
};
