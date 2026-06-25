export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[var(--color-navy)] text-[var(--color-paper)] py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto text-center space-y-4">
        <div className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          ★ DATEWADE.COM ★
        </div>
        <div className="font-[family-name:var(--font-display-2)] tracking-[0.18em] text-xs sm:text-sm text-[var(--color-yellow)]">
          THIS PROMOTION ENDS WHEN HE GETS A GIRLFRIEND
        </div>
        <p className="max-w-xl mx-auto text-xs sm:text-sm text-[var(--color-cream)]/70 leading-relaxed">
          NOT A REAL INFOMERCIAL. NOT AFFILIATED WITH HINGE OR ANY DATING APP.
          OPERATORS ARE NOT STANDING BY. NO PURCHASE NECESSARY. VOID WHERE
          PROHIBITED BY GOOD SENSE. SOME RESTRICTIONS MAY APPLY,
          NAMELY THAT HE LIVES IN DENVER. ©&nbsp;{year}&nbsp;WADE.
        </p>
      </div>
    </footer>
  );
}
