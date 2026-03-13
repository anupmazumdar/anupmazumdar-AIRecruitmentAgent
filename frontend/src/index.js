import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import './index.css';
import App from './App';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

const AUTH0_DOMAIN = process.env.REACT_APP_AUTH0_DOMAIN || 'dev-shjk32vx4oscfrde.us.auth0.com';
const AUTH0_CLIENT_ID = process.env.REACT_APP_AUTH0_CLIENT_ID || 'KHC4ncaBYv0W4NqgVSLD5vJI8SuqPHDk';
const AUTH0_REDIRECT_URI = process.env.REACT_APP_AUTH0_REDIRECT_URI || 'https://anupmazumdar-ai-recruitment-agent.vercel.app/';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: AUTH0_REDIRECT_URI }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </BrowserRouter>
    </Auth0Provider>
  </React.StrictMode>
);
