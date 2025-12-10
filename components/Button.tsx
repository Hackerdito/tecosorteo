import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "w-full py-3 px-6 rounded-xl font-bold transition-all duration-200 transform active:scale-95 shadow-lg flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-900/50 border-2 border-red-800",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white border-2 border-slate-600",
    danger: "bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${disabled || isLoading ? 'opacity-50 cursor-not-allowed grayscale' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
};