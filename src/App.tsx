import React from 'react';
// Corrected import paths - Assuming components are directly in 'src/components'
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Categories from './components/Categories';
import FeaturedProducts from './components/FeaturedProducts';
import Contact from './components/Contact';
import Footer from './components/Footer';
// This path was likely correct as Claude created this folder structure
import AdminDashboard from './components/admin/AdminDashboard'; 
import './App.css';

// Check the URL hash directly. This code runs before React even renders.
const isAdminRoute = window.location.hash === '#admin';

// The main App component
function App() {
  // If the URL hash is '#admin', render ONLY the AdminDashboard.
  if (isAdminRoute) {
    return <AdminDashboard />;
  }

  // Otherwise, render the main website.
  return (
    <div className="App">
      <Navbar />
      <Hero />
      <Categories />
      <FeaturedProducts />
      <Contact />
      <Footer />
    </div>
  );
}

export default App;
