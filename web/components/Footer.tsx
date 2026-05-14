export default function Footer() {
  return (
    <div className="bg-[var(--primary-element)] text-[var(--text-primary)] p-5 w-full mt-auto grid grid-cols-3 items-center">
      <div />
      <p className="text-center">&copy; 2026 Lönsamhetskalkyl. Alla rättigheter förbehållna.</p>
      <div className="flex justify-end">
        <img
          src="../CMYKlodjur_emblem_gultext.png"
          alt="Börjes Bolagen"
          className="footer-logo-light h-12 w-auto"
        />
        <img
          src="../CMYKlodjur_emblem_INV.png"
          alt="Börjes Bolagen"
          className="footer-logo-dark h-12 w-auto"
        />
      </div>
    </div>
  );
}