import React from 'react';
import ReactDOM from 'react-dom/client';

window.addEventListener('error', function(e) {
  document.body.style.background = 'white';
  document.body.innerHTML = '<div style="padding:20px;font-size:16px;color:red;">' + e.message + '<br/>' + e.filename + '<br/>Line: ' + e.lineno + '</div>';
});

window.addEventListener('unhandledrejection', function(e) {
  document.body.style.background = 'white';
  document.body.innerHTML = '<div style="padding:20px;font-size:16px;color:blue;">PROMISE: ' + e.reason + '</div>';
});

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
} catch(e) {
  document.body.style.background = 'white';
  document.body.innerHTML = '<div style="padding:20px;font-size:16px;color:green;">CATCH: ' + e.message + '</div>';
}