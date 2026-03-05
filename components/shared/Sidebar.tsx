
import React from 'react';
import { User } from '../../types';

type Page = 'dashboard' | 'stock' | 'carParts' | 'suppliers' | 'clients' | 'employees' | 'users' | 'assets' | 'categories' | 'reports' | 'quotes' | 'nfcontrol' | 'workorders' | 'purchaseorders' | 'activitylog' | 'exits';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentUser: User | null;
}

const NavLink: React.FC<{
  page: Page;
  currentPage: Page;
  onClick: () => void;
  icon: React.ReactElement;
  label: string;
}> = ({ page, currentPage, onClick, icon, label }) => {
  const isActive = currentPage === page;

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center space-x-4 px-4 py-3 
        rounded-lg text-left transition-all duration-300 ease-in-out
        group
        ${
          isActive
            ? 'bg-secondary text-white font-bold shadow-lg'
            : 'text-gray-300 hover:bg-accent hover:text-white hover:pl-6'
        }
      `}
    >
      <div className="transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <span className="font-medium">{label}</span>
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, isOpen, setIsOpen, currentUser }) => {
    const iconClass = "w-6 h-6";

    const handleNavigation = (page: Page) => {
        setCurrentPage(page);
        if (window.innerWidth < 768) {
            setIsOpen(false);
        }
    };
    
    const userRole = currentUser?.role;

    return (
        <>
            {/* Overlay for mobile */}
            <div 
                className={`fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            ></div>

            <div className={`
                fixed md:relative z-40 flex flex-col w-64 bg-neutral text-white shadow-2xl 
                h-full transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                md:translate-x-0
            `}>
                <div className="flex items-center justify-center h-20 border-b border-gray-700/50">
                     <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7l8 4"></path></svg>
                    <h1 className="text-2xl font-bold ml-2 tracking-wider">StockSys</h1>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <NavLink 
                        page="dashboard" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('dashboard')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>} 
                        label="Dashboard" 
                    />
                    <NavLink 
                        page="workorders" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('workorders')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547a2 2 0 00-.547 1.806l.477 2.387a6 6 0 00.517 3.86l.158.318a6 6 0 003.86.517l2.387.477a2 2 0 001.806-.547a2 2 0 00.547-1.806l-.477-2.387a6 6 0 00-.517-3.86l-.158-.318z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.25 10.25a2.5 2.5 0 01-3.536 0l-2.828-2.829a2.5 2.5 0 010-3.535l.707-.707a2.5 2.5 0 013.535 0L14.25 7.5l.707.707a2.5 2.5 0 010 3.535L12.121 15" /></svg>} 
                        label="Ordens de Serviço" 
                    />
                    <NavLink 
                        page="stock" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('stock')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>} 
                        label="Estoque (Consumo)" 
                    />
                    <NavLink 
                        page="exits" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('exits')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>} 
                        label="Controle de Saídas" 
                    />
                     <NavLink 
                        page="carParts" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('carParts')} 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.471-2.471a.563.563 0 01.8 0l2.471 2.471M11.42 15.17l-4.63-4.63a.563.563 0 010-.8l2.471-2.471a.563.563 0 01.8 0l2.471 2.471m-5.877 5.877l-2.471-2.471a.563.563 0 010-.8l2.471-2.471m0 0l2.471 2.471" /></svg>} 
                        label="Peças Automotivas" 
                    />
                     <NavLink 
                        page="assets" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('assets')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>} 
                        label="Patrimônio" 
                    />
                    <NavLink 
                        page="purchaseorders" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('purchaseorders')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>} 
                        label="Ordens de Compra" 
                    />
                    <NavLink 
                        page="categories" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('categories')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"></path></svg>} 
                        label="Categorias" 
                    />
                    <NavLink 
                        page="clients" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('clients')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.282-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.282.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>} 
                        label="Clientes" 
                    />
                    <NavLink 
                        page="suppliers" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('suppliers')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>} 
                        label="Fornecedores" 
                    />
                    <NavLink 
                        page="employees" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('employees')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-1.781-4.121M12 12a4 4 0 110-8 4 4 0 010 8z"></path></svg>} 
                        label="Funcionários" 
                    />
                    <NavLink 
                        page="quotes" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('quotes')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>} 
                        label="Orçamentos" 
                    />
                    <NavLink 
                        page="nfcontrol" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('nfcontrol')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>} 
                        label="Controle de NF" 
                    />
                    <NavLink 
                        page="reports" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('reports')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>} 
                        label="Relatórios" 
                    />
                    <NavLink 
                        page="users" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('users')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>} 
                        label="Usuários" 
                    />
                    <NavLink 
                        page="activitylog" 
                        currentPage={currentPage} 
                        onClick={() => handleNavigation('activitylog')} 
                        icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3h3m-3 4h3m-3 4h3"></path></svg>} 
                        label="Log de Atividades" 
                    />
                </nav>
            </div>
        </>
    );
};
