'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '/',              label: 'Writings' },
  { href: '/short-stories', label: 'Short Stories' },
  { href: '/books',         label: 'Books' },
  { href: '/author',        label: 'Author' },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="container mx-auto px-8 h-[60px] flex items-center justify-between max-w-7xl">
        <Link href="/" className="font-serif text-[22px] font-bold tracking-tight">DILSe</Link>

        <div className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-[14px] text-gray-800 hover:underline underline-offset-4 decoration-1 transition-colors ${
                pathname === l.href ? 'underline' : ''
              }`}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://api.whatsapp.com/send?phone=918886956636&text=Hey"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-5 h-9 text-[13px] font-medium bg-green-500 text-white hover:bg-green-600 transition-colors inline-flex items-center"
          >
            Hire Me
          </a>
          <a
            href="https://whatsapp.com/channel/0029VbBAPnAGk1Fpc0cmqt40"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-5 h-9 text-[13px] font-medium bg-black text-white hover:bg-gray-800 transition-colors inline-flex items-center"
          >
            Join My Community
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center text-black"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 z-40 bg-black md:hidden"
          >
            <div className="flex h-full flex-col px-8 pt-[78px] pb-10 text-white">
              <div className="mb-12 border-b border-white/15 pb-6">
                <p className="font-serif text-[22px] tracking-tight">DILSe</p>
              </div>
              <div className="flex flex-1 flex-col justify-center gap-8">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="font-serif text-3xl tracking-tight text-white transition-opacity duration-200 hover:opacity-70"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              <a
                href="https://api.whatsapp.com/send?phone=918886956636&text=Hey"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="mt-auto inline-flex w-fit items-center rounded-full bg-green-500 px-5 py-3 text-sm text-white mb-3"
              >
                Hire Me
              </a>
              <a
                href="https://whatsapp.com/channel/0029VbBAPnAGk1Fpc0cmqt40"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="inline-flex w-fit items-center rounded-full border border-white/20 px-5 py-3 text-sm text-white"
              >
                Join My Community
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
