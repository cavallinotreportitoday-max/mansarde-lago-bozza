// Cose in comune ai movimenti del sito (dalla base grafica, lotto «Movimento rifinito»).
// - durate lette dal CSS (:root), così JS e CSS non si contraddicono
// - dissolvenza breve per i valori che cambiano (totale, righe del conto)
// - tastiera o dito: dopo la chiusura di una finestra il fuoco torna sul pulsante solo a chi usa la tastiera
const radice = document.documentElement;
const ridotto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Durata in ms di una variabile del CSS (es. '--t-chiudi'); 0 con «Riduci movimento» */
export function durata(nome, riserva = 300, rispettaRidotto = true) {
	if (rispettaRidotto && ridotto()) return 0;
	const v = getComputedStyle(radice).getPropertyValue(nome).trim();
	const n = parseFloat(v);
	if (!Number.isFinite(n)) return riserva;
	return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}

/** Un valore appena cambiato (stima, testi di un esempio) compare con una dissolvenza breve.
 *  Solo decorazione: il testo nuovo c'è già; al massimo una volta ogni --t-rapido (scrivendo in fretta niente lampeggi) */
export function ravviva(el) {
	if (!el || ridotto()) return;
	const ora = performance.now();
	if (el._ravvivato && ora - el._ravvivato < durata('--t-rapido', 150)) return;
	el._ravvivato = ora;
	el.classList.remove('is-nuovo');
	void el.offsetWidth;
	el.classList.add('is-nuovo');
}

/* ---------- Tastiera o dito ---------- */
let tastiera = false;
addEventListener('keydown', (e) => {
	if (!e.metaKey && !e.ctrlKey && !e.altKey) tastiera = true;
}, true);
addEventListener('pointerdown', () => (tastiera = false), true);
/** L'ultimo comando è arrivato dalla tastiera? (col dito niente fuoco spostato e niente riquadro) */
export const daTastiera = () => tastiera;
