"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Registered once, at module scope, rather than per-component — repeat
// registration is harmless but pointless, and every GSAP consumer in the app
// imports gsap/ScrollTrigger through this file so it only happens here.
gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };
