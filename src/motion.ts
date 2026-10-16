import {useEffect,useState} from 'react';
export const motion={scroll:0,velocity:0,tour:0,pointerX:0,pointerY:0,reduced:false,mobile:false,gyroAllowed:false};
export function useMotionPreference(){const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>{motion.reduced=q.matches;setReduced(q.matches)};sync();q.addEventListener('change',sync);return()=>q.removeEventListener('change',sync)},[]);return reduced;}
