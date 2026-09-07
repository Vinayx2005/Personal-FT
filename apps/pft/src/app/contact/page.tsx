import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata = {
  title: 'Contact us · Personal FT',
  description: 'Reach Personal FT support at vinayteja23@gmail.com.',
};

export default function ContactPage() {
  return (
    <LegalPageLayout title="Contact us" updatedOn="14 August 2026">
      <div className="not-prose mt-6 rounded-2xl border border-18-orange/40 bg-18-orange/10 p-6 text-center">
        <p className="text-xs uppercase tracking-widest font-bold text-18-orange !my-0">
          Email us
        </p>
        <a
          href="mailto:vinayteja23@gmail.com"
          className="!text-white !no-underline hover:!underline text-2xl md:text-3xl font-black block mt-3"
        >
          vinayteja23@gmail.com
        </a>
      </div>
    </LegalPageLayout>
  );
}
