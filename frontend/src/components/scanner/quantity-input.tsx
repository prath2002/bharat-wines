"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function QuantityInput({ value, onChange, min = 1, max = 9999 }: QuantityInputProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      if (val >= min && val <= max) {
        onChange(val);
      } else if (val > max) {
        onChange(max);
      }
    } else if (e.target.value === "") {
      // Allow empty temporarily while typing, but parent should enforce min
      onChange(min);
    }
  };

  return (
    <div className="flex items-center w-full max-w-[200px] h-14 border rounded-xl overflow-hidden shadow-sm bg-white">
      <button 
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="w-14 h-full flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 border-r transition-colors"
      >
        <Minus className="h-5 w-5" />
      </button>
      
      <input 
        type="number" 
        className="flex-1 h-full text-center text-xl font-bold border-none outline-none focus:ring-0 p-0"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
      />
      
      <button 
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="w-14 h-full flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 border-l transition-colors"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
