import React,{createContext,useContext,useCallback,useEffect,useState} from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { State,User,Language } from '@tech-trolley/contracts';
import { api,tokenKey } from '../services/api';
const Context=createContext<any>(null);
export function useShop():{state:State|null;user:User|null;lang:Language;dark:boolean;error:string;loading:boolean;refresh:()=>Promise<void>;login:(i:string,p:string)=>Promise<void>;logout:()=>Promise<void>;setLang:(l:Language)=>void;setDark:(d:boolean)=>void}{return useContext(Context);}
export function ShopProvider({children}:{children:React.ReactNode}){const [state,setState]=useState<State|null>(null),[user,setUser]=useState<User|null>(null),[lang,setLangValue]=useState<Language>('bn'),[dark,setDarkValue]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{try{if(!await SecureStore.getItemAsync(tokenKey)){setUser(null);setState(null);setLoading(false);return;}const u=await api.me();setUser(u);if(!u.must_change)setState(await api.state());setError('');}catch(e:any){if(e.status===401){await SecureStore.deleteItemAsync(tokenKey);setUser(null);setState(null);}else setError(e.code||'NETWORK_ERROR');}finally{setLoading(false);}},[]);
 useEffect(()=>{void AsyncStorage.multiGet(['tt-language','tt-theme']).then(items=>{setLangValue(items[0][1]==='en'?'en':'bn');setDarkValue(items[1][1]==='dark');});void refresh();const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},30000);const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});return()=>{clearInterval(timer);sub.remove();};},[refresh]);
 useEffect(()=>{if(!user)return;const timer=setInterval(()=>{void api.request<{token:string}>('/auth/refresh','POST').then(r=>SecureStore.setItemAsync(tokenKey,r.token)).catch(()=>{});},15*60000);return()=>clearInterval(timer);},[user]);
 const login=async(identity:string,password:string)=>{const r=await api.login(identity,password);if(!r.token)throw new Error('SESSION_EXPIRED');await SecureStore.setItemAsync(tokenKey,r.token,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});await refresh();};
 const logout=async()=>{await api.logout();await SecureStore.deleteItemAsync(tokenKey);setUser(null);setState(null);};
 const setLang=(l:Language)=>{setLangValue(l);void AsyncStorage.setItem('tt-language',l);},setDark=(d:boolean)=>{setDarkValue(d);void AsyncStorage.setItem('tt-theme',d?'dark':'light');};
 return <Context.Provider value={{state,user,lang,dark,error,loading,refresh,login,logout,setLang,setDark}}>{children}</Context.Provider>;
}
