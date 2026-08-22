# 💈 Barber 3D — Premium Men's Barber Experience

A modern, immersive **3D men's barber shop website** built with React, Tailwind CSS, Three.js, and React Three Fiber.

The goal is to create more than a traditional barber website. Customers can explore hairstyles, see **3D haircut transformations**, view real customer testimonials, meet barbers, explore services, and book an appointment through an interactive experience.

## Backend API

The Django backend provides service, booking, availability, and account-registration endpoints. From `backend`, run:

```bash
python manage.py migrate
python manage.py runserver
```

The booking API calculates each appointment end time from the selected service, rejects inactive services and overlapping appointments, and exposes available times at `GET /api/bookings/availability/`. See [API request and response examples](docs/api_endpoints.md).

---

## ✨ Project Vision

> **Your style. Your identity. Your barber.**

Barber 3D is designed as a premium digital experience for a modern men's barber shop.

Instead of showing only static images and testimonial cards, the website uses 3D models and cinematic animations to demonstrate the customer's journey:

```text
BEFORE
   ↓
HAIRCUT EXPERIENCE
   ↓
AFTER
   ↓
CUSTOMER TESTIMONIAL
   ↓
BOOK YOUR CHAIR
```

The website should feel:

* Premium
* Modern
* Cinematic
* Interactive
* Fast
* Mobile-friendly
* Professional

---

# 🎯 Main Goals

The website will allow customers to:

* Explore the barber shop
* Discover different haircut styles
* Interact with 3D customer models
* See before/after haircut transformations
* Read real customer testimonials
* Meet professional barbers
* Explore barber services
* View pricing
* Book appointments
* Experience a premium interactive website

---

# 🧰 Technology Stack

## Frontend

* React
* Vite
* JavaScript
* Tailwind CSS
* React Router

## 3D

* Three.js
* React Three Fiber
* React Three Drei
* GLTF / GLB models

## Animation

* GSAP
* Scroll-based animations
* 3D camera animations
* Micro-interactions

## Backend — Future

The first version can be frontend-only.

Future versions can use:

* Django
* Django REST Framework
* PostgreSQL
* JWT Authentication

---

# 📦 Installation

Create the project:

```bash
npm create vite@latest barber-3d -- --template react
```

Enter the project:

```bash
cd barber-3d
```

Install dependencies:

```bash
npm install
```

Install Tailwind:

```bash
npm install tailwindcss @tailwindcss/vite
```

Install 3D libraries:

```bash
npm install three @react-three/fiber @react-three/drei
```

Install animation:

```bash
npm install gsap
```

Run the development server:

```bash
npm run dev
```

---

# 📁 Project Structure

The project will eventually use the following structure:

```text
barber-3d/
│
├── public/
│   ├── models/
│   │   ├── customers/
│   │   ├── barbers/
│   │   ├── hairstyles/
│   │   └── environment/
│   │
│   ├── textures/
│   ├── images/
│   └── icons/
│
├── src/
│   │
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Button.jsx
│   │   ├── SectionTitle.jsx
│   │   ├── ServiceCard.jsx
│   │   ├── BarberCard.jsx
│   │   └── TestimonialCard.jsx
│   │
│   ├── sections/
│   │   ├── Hero.jsx
│   │   ├── Transformations.jsx
│   │   ├── Haircuts.jsx
│   │   ├── Barbers.jsx
│   │   ├── Services.jsx
│   │   ├── Testimonials.jsx
│   │   ├── Experience.jsx
│   │   └── Booking.jsx
│   │
│   ├── three/
│   │   ├── BarberScene.jsx
│   │   ├── CustomerModel.jsx
│   │   ├── HaircutModel.jsx
│   │   ├── BarberChair.jsx
│   │   └── CameraController.jsx
│   │
│   ├── data/
│   │   ├── haircuts.js
│   │   ├── services.js
│   │   ├── barbers.js
│   │   └── testimonials.js
│   │
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Haircuts.jsx
│   │   ├── Barbers.jsx
│   │   └── Booking.jsx
│   │
│   ├── assets/
│   │   ├── images/
│   │   └── fonts/
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── .gitignore
├── package.json
└── README.md
```

---

# 🗺️ Website Structure

The homepage will follow this experience:

```text
NAVBAR
   ↓
HERO
   ↓
3D HAIRCUT EXPERIENCE
   ↓
HAIRCUT STYLES
   ↓
CUSTOMER TRANSFORMATIONS
   ↓
MEET THE BARBERS
   ↓
SERVICES
   ↓
TESTIMONIALS
   ↓
BOOKING
   ↓
FOOTER
```

---

# 🎬 1. Hero Section

The hero is the first impression.

It will contain:

* Barber shop branding
* Large typography
* 3D customer model
* Short introduction
* CTA buttons
* Cinematic lighting
* Subtle camera movement

Example:

```text
YOUR STYLE.
YOUR IDENTITY.

Premium men's grooming
crafted by professionals.

[ EXPLORE HAIRCUTS ]

[ BOOK YOUR CHAIR ]
```

The 3D customer should slowly rotate or respond subtly to mouse movement.

---

# ✂️ 2. 3D Haircut Experience

This is the main feature.

The customer should be able to see:

```text
BEFORE
   ↓
CUTTING
   ↓
AFTER
```

Scrolling can control the experience.

Example:

```text
Scroll ↓

3D customer appears

        ↓

Barber tools appear

        ↓

Camera moves closer

        ↓

Haircut transformation

        ↓

Final hairstyle

        ↓

Customer testimonial
```

---

# 👤 3. Customer Transformations

Each customer becomes an interactive testimonial.

Example:

```text
CUSTOMER #001

[ 3D CUSTOMER ]

BEFORE  →  AFTER

HAIRCUT:
Low Fade + Textured Crop

★★★★★

"Best haircut I've had.
The barber understood exactly
what I wanted."

— Daniel
```

Users can navigate:

```text
← Previous       Next →
```

---

# 💇 4. Haircut Styles

The website will showcase different hairstyles.

Initial styles:

```text
Low Fade
Mid Fade
High Fade
Skin Fade
Buzz Cut
Textured Crop
Classic Cut
Beard Design
```

Each haircut can contain:

```javascript
{
  id: 1,
  name: "Low Fade",
  description: "Clean and subtle fade.",
  price: 350,
  duration: "35 min",
  model: "/models/low-fade.glb"
}
```

---

# 👨‍🦱 5. Meet the Barbers

Show the people behind the work.

Each barber can have:

```text
Name
Photo
Specialty
Experience
Rating
Number of cuts
```

Example:

```text
ALEX TESFAYE

Master Barber

Fade Specialist
Beard Design

★★★★★

1,200+ Haircuts
```

---

# 💈 6. Services

Services should be simple and premium.

Example:

```text
SIGNATURE CUT
45 MIN
350 ETB

FADE + BEARD
60 MIN
500 ETB

ROYAL SHAVE
45 MIN
400 ETB

FULL GROOMING
90 MIN
750 ETB
```

Prices should eventually come from the backend instead of being hardcoded.

---

# ⭐ 7. Testimonials

Testimonials should combine:

* Customer
* Haircut
* Before/after
* Rating
* Review
* Optional 3D model

Example:

```text
★★★★★

"I showed the barber a picture
and he created exactly what I wanted."

— Michael

Low Fade + Beard
```

---

# 📅 8. Booking System

The final goal is to allow customers to book a chair.

Booking flow:

```text
Choose Service
       ↓
Choose Barber
       ↓
Choose Date
       ↓
Choose Time
       ↓
Customer Information
       ↓
Confirm Booking
```

Example:

```text
BOOK YOUR CHAIR

Service:
[ Fade + Beard ]

Barber:
[ Alex ]

Date:
[ August 12 ]

Time:
[ 4:30 PM ]

Name:
[____________]

Phone:
[____________]

[ CONFIRM BOOKING ]
```

---

# 🎨 Design Direction

The visual identity should feel like a premium men's grooming studio.

### Colors

Primary:

```text
Black
#0B0B0B
```

Surface:

```text
#151515
```

Text:

```text
Warm White
```

Accent:

```text
Bronze / Gold
```

The design should use:

* Dark backgrounds
* Large typography
* High-quality photography
* Cinematic lighting
* Subtle gradients
* Premium spacing
* Smooth transitions
* Minimal glass effects

Avoid excessive:

* Neon colors
* Random gradients
* Glassmorphism
* Unnecessary animations

---

# 🧠 3D Development Strategy

Do not make the entire website 3D.

Use normal React/Tailwind for:

```text
Navbar
Text
Services
Booking
Forms
Testimonials
Footer
```

Use Three.js for:

```text
Customer
Hair
Barber chair
Barber tools
Haircut transformations
Interactive scenes
```

This keeps the website performant.

---

# 🧱 Development Roadmap

## Phase 1 — Project Setup

* [ ] Create Vite project
* [ ] Configure Tailwind
* [ ] Install Three.js
* [ ] Install React Three Fiber
* [ ] Install Drei
* [ ] Install GSAP
* [ ] Configure Git
* [ ] Create project structure

---

## Phase 2 — Design System

* [ ] Choose fonts
* [ ] Define colors
* [ ] Define spacing
* [ ] Create buttons
* [ ] Create typography system
* [ ] Create responsive layout

---

## Phase 3 — Basic Website

* [ ] Navbar
* [ ] Hero
* [ ] Services
* [ ] Haircuts
* [ ] Barbers
* [ ] Testimonials
* [ ] Booking
* [ ] Footer

No 3D yet.

---

## Phase 4 — First 3D Scene

Learn:

* [ ] Canvas
* [ ] Camera
* [ ] Lights
* [ ] Mesh
* [ ] Materials
* [ ] GLB models
* [ ] Environment
* [ ] OrbitControls

Build:

```text
3D Customer
+
Camera
+
Lighting
+
Rotation
```

---

## Phase 5 — 3D Interaction

Add:

* [ ] Mouse interaction
* [ ] Camera movement
* [ ] Model rotation
* [ ] Scroll interaction
* [ ] Haircut selection
* [ ] Smooth transitions

---

## Phase 6 — Haircut Transformation

Build:

```text
Before
 ↓
Cutting
 ↓
After
```

This becomes the signature feature of the website.

---

## Phase 7 — Customer Testimonials

Create:

```text
Customer
+
3D Model
+
Haircut
+
Before/After
+
Review
```

---

## Phase 8 — GSAP

Use GSAP for:

* [ ] Hero animation
* [ ] Scroll animation
* [ ] Camera transitions
* [ ] Text animation
* [ ] Section transitions
* [ ] Micro-interactions

---

## Phase 9 — Booking

Create:

* [ ] Service selection
* [ ] Barber selection
* [ ] Date selection
* [ ] Time selection
* [ ] Customer information
* [ ] Confirmation

---

## Phase 10 — Backend

Future architecture:

```text
React
   ↓
Django REST Framework
   ↓
PostgreSQL
```

Backend models:

```text
User
Barber
Service
Haircut
Customer
Testimonial
Appointment
Availability
```

---

# ⚡ Performance Goals

The website should remain fast even with 3D.

Focus on:

* GLB optimization
* Draco compression
* KTX2 textures
* Lazy loading
* Texture optimization
* Limited polygon count
* Lazy-loaded 3D scenes
* Mobile performance
* Reduced animation on low-end devices

Target:

```text
Desktop: Excellent
Mobile: Excellent
3D: Smooth
Initial Load: Fast
```

---

# 📱 Responsive Design

The website must support:

```text
Mobile
Tablet
Laptop
Desktop
Large Desktop
```

Desktop can use:

```text
Large 3D scene
+
Large typography
+
Cinematic layout
```

Mobile should simplify the 3D experience:

```text
3D customer
        ↓
Headline
        ↓
CTA
```

Do not simply shrink the desktop design.

---

# 🔐 Future Features

Possible future features:

* User accounts
* Online payments
* Appointment management
* Barber dashboard
* Admin dashboard
* Customer profiles
* Haircut history
* Loyalty program
* Reviews
* Notifications
* SMS/email appointment reminders
* WhatsApp booking
* Analytics

---

# 🚀 Long-Term Vision

The final product should become more than a website.

It can become a complete barber management platform:

```text
                 BARBER 3D
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
     Customer      Barber       Admin
        │            │            │
        ▼            ▼            ▼
    Booking       Schedule     Analytics
    Reviews       Clients      Services
    Haircuts      Revenue      Staff
```

---

# 📌 Current Development Goal

The first milestone is **not** to build the complete platform.

The first milestone is:

```text
React + Tailwind
       +
Beautiful Barber Landing Page
       +
One High-Quality 3D Customer
       +
Interactive Haircut Experience
```

Once this is polished, the rest of the platform can be built around it.

---

# 👨‍💻 Development Principle

> **Build the experience first. Add complexity only when it improves the customer experience.**

The goal is not to demonstrate that the website uses Three.js.

The goal is to make customers think:

> **"I've never seen a barber website like this before."**

---

## 📈 Version Roadmap

### v0.1 — Foundation

React + Tailwind + basic layout

### v0.2 — 3D

First interactive customer model

### v0.3 — Transformation

Before → Haircut → After

### v0.4 — Testimonials

Interactive customer stories

### v0.5 — Booking

Complete appointment UI

### v1.0 — Production

Backend + database + authentication + booking management

---

## 📄 License

This project is currently private and intended for development and portfolio/business use.
