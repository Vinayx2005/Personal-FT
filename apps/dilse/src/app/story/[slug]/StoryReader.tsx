'use client';

import Link from 'next/link';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ScrollBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  return <motion.div className="fixed top-[60px] left-0 right-0 h-1 bg-black z-40 origin-left" style={{ scaleX }} />;
}

export function ShareOnWhatsApp({ title }: { title: string }) {
  const [href, setHref] = useState('#');
  useEffect(() => {
    setHref(`https://wa.me/?text=${encodeURIComponent(`${title} — ${window.location.href}`)}`);
  }, [title]);
  return (
    <footer className="mt-24 pt-12 border-t border-gray-200 flex flex-col items-center">
      <p className="font-serif italic mb-8 text-[16px]">Loved the story? Share it with someone special.</p>
      <a href={href} target="_blank" rel="noopener noreferrer"
         className="rounded-full px-8 py-4 font-serif bg-black text-white hover:bg-gray-800 flex items-center gap-3">
        <Share2 size={18} /> Share on WhatsApp
      </a>
    </footer>
  );
}

export function BackLink() {
  return (
    <Link href="/short-stories" className="inline-flex items-center gap-2 text-sm font-serif text-gray-500 hover:text-black mb-12 transition-colors">
      <ArrowLeft size={16} /> Back to stories
    </Link>
  );
}
