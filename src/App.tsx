import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Categories from './components/Categories';
import FeaturedProducts from './components/FeaturedProducts';
import Contact from './components/Contact';
import Footer from './components/Footer';
import AdminDashboard from './components/admin/AdminDashboard';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('home');

  useEffect(() => {
    // Function to check the URL hash and update the view
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setCurrentView('admin');
      } else {
        setCurrentView('home');
      }
    };

    // Check the hash when the component first loads
    handleHashChange();

    // Listen for changes in the hash (e.g., user clicks a link)
    window.addEventListener('hashchange', handleHashChange);

    // Cleanup the event listener when the component unmounts
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // The empty array means this effect runs only once on mount

  // Conditional rendering based on the current view
  if (currentView === 'admin') {
    // If the view is 'admin', show only the Admin Dashboard
    return <AdminDashboard />;
  }

  // Otherwise, show the main website
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
