 
import React, { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import Loadable from '../layouts/full/shared/loadable/Loadable';

/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const FullFillLayout = Loadable(lazy(() => import('../layouts/full/FullFillLayout')));
const BoxedLayout = Loadable(lazy(() => import('../layouts/full/BoxedLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));
// const MonacoLayout = Loadable(lazy(() => import('../layouts/MonacoLayout')));

/* ****Pages***** */
const SamplePage = Loadable(lazy(() => import('../views/sample-page/SamplePage')));
const HomePage = Loadable(lazy(() => import('../views/home-page/HomePage')));
const LandingPage = Loadable(lazy(() => import('../views/landing-page/LandingPage')));
//const BlocklyPage = Loadable(lazy(() => import('../views/blockly-page/BlocklyPage')));
//const BlocklyPage =  '../views/blockly-page/BlocklyPage';
import BlocklyPage from '../views/blockly-page/BlocklyPage';
import MonacoPage from '../views/monaco-page/MonacoPage';
// const MonacoPage = Loadable(lazy(() => import('../views/monaco-page/MonacoPage')));
const HuaPage = Loadable(lazy(() => import('../views/sub-pages/HuaPage')));
const Register = Loadable(lazy(() => import('../views/authentication/Register')));
const Login = Loadable(lazy(() => import('../views/authentication/Login')));
const Error = Loadable(lazy(() => import('../views/authentication/Error')));

const Router = [
  {
    path: '/sample-page',
    element: <BoxedLayout />,
    children: [
      { path: '/sample-page', exact: true, element: <SamplePage /> },
    ],
  },
  {
    path: '/home-page',
    element: <BoxedLayout />,
    children: [
      { path: '/home-page', exact: true, element: <HomePage /> },
    ],
  },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/', element: <Navigate to="/landing-page" /> },
      { path: '/landing-page', exact: true, element: <LandingPage /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },  
  {
    path: '/hua-page',
    element: <BlankLayout />,
    children: [
      { path: '/hua-page', exact: true, element: <HuaPage /> },
    ],
  },
  {
    path: '/auth',
    element: <BlankLayout />,
    children: [
      { path: '/auth/login', element: <Login /> },
      { path: '/auth/register', element: <Register /> },
      { path: '/auth/404', element: <Error /> },
    ],
  },
  {
    path: '/blockly-page',
    element: <FullFillLayout />,
    children: [
      { path: '/blockly-page', exact: true, element: <BlocklyPage/> },
    ],
  },  
  {
    path: '/monaco-page',
    element: <FullLayout />,
    children: [
      { path: '/monaco-page', exact: true, element: <MonacoPage /> },
    ],
  },
  {
    path: '/auth',
    element: <BlankLayout />,
    children: [
      { path: '404', element: <Error /> },
    ],
  },
];

export default Router;
