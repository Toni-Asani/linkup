import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

window.onerror = function(msg, src, line, col, error) {
  document.body.innerHTML = '<div style="padding:20px;font-size:20px;color:red;background:white;">' + msg + '<br/>Line: ' + line + '</div>';
  return false;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();