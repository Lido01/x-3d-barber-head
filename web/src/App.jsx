import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import Haircuts from "./pages/Haircuts";
import Barbers from "./pages/Barbers";
import Booking from "./pages/Booking";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <div className="min-h-screen bg-[#090909] text-[#f4f0e8]">
      <Navbar />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/haircuts" element={<Haircuts />} />
          <Route path="/barbers" element={<Barbers />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}