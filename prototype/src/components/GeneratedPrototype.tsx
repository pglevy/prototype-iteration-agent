import React, { useState } from 'react';

const TemperatureConverter: React.FC = () => {
  const [temperature, setTemperature] = useState<string>('');
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [convertedTemperature, setConvertedTemperature] = useState<string>('');

  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTemperature(e.target.value);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUnit(e.target.value as 'C' | 'F');
  };

  const convertTemperature = () => {
    const tempValue = parseFloat(temperature);
    if (!isNaN(tempValue)) {
      if (unit === 'C') {
        setConvertedTemperature(((tempValue * 9) / 5 + 32).toFixed(2) + ' °F');
      } else {
        setConvertedTemperature(((tempValue - 32) * (5 / 9)).toFixed(2) + ' °C');
      }
    } else {
      setConvertedTemperature('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Temperature Converter</h1>
      <input
        type="text"
        value={temperature}
        onChange={handleTemperatureChange}
        placeholder="Enter temperature"
        className="p-2 mb-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <select value={unit} onChange={handleUnitChange} className="p-2 mb-2 border border-gray-300 rounded">
        <option value="C">Celsius (°C)</option>
        <option value="F">Fahrenheit (°F)</option>
      </select>
      <button
        onClick={convertTemperature}
        className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition"
      >
        Convert
      </button>
      {convertedTemperature && (
        <p className="mt-4 text-lg font-semibold">
          Converted Temperature: {convertedTemperature}
        </p>
      )}
    </div>
  );
};

export default TemperatureConverter;