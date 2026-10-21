'use client';
import {createContext,useContext} from 'react';
import type {CRMContextValue} from '../lib/types';
export const CRMContext=createContext<CRMContextValue|null>(null);
export function useCRM():CRMContextValue {const value=useContext(CRMContext);if(!value)throw new Error('CRM indisponível.');return value;}
