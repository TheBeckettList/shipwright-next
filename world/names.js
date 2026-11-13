// inherency: data (a vision table: names, the one choice per people)
// Pure. What the folk are called: given names in each people's own manner (common historical names of the
// world each tradition came from), dealt by the golden sequence so neighbours differ. The north-woods and arctic
// lists are built from words of those languages, as names there often were: to be checked by someone who speaks them.
import { golden } from "../core/golden.js";
export const NAMES = {
  norse: ["Astrid", "Bjorn", "Gudrun", "Leif", "Sigrid", "Ragnar", "Thora", "Halfdan", "Ingrid", "Ulf", "Freydis", "Eirik", "Solveig"],
  european: ["Agnes", "Thomas", "Mathilde", "Pieter", "Elsbeth", "Johan", "Margery", "Hugh", "Beatrix", "Willem", "Isolde", "Conrad", "Alys"],
  birchbark: ["Nokomis", "Ozhaawashko", "Migizi", "Waaboozoo", "Giizhig", "Makwa", "Anang", "Ogimaa", "Zhaawan", "Binesi", "Mishiikenh", "Waabanang", "Ajijaak"],
  pacific: ["Tama", "Hina", "Rangi", "Moana", "Tane", "Lani", "Kahu", "Mere", "Tui", "Aroha", "Manu", "Leilani", "Hemi"],
  indian_ocean: ["Amina", "Bakari", "Zawadi", "Hamisi", "Mwanaisha", "Salim", "Rehema", "Juma", "Fatuma", "Omari", "Zuhura", "Rashidi", "Halima"],
  east_asian: ["Mei", "Wei", "Lan", "Jun", "Hua", "Bo", "Ying", "Tao", "Xiu", "Ming", "Lian", "Kang", "Yue"],
  japanese: ["Hana", "Taro", "Yuki", "Kenji", "Aiko", "Hiroshi", "Sakura", "Isamu", "Chiyo", "Masaru", "Emi", "Daichi", "Fumiko"],
  dugout: ["of the Ravens", "of the Eagles"],   // given: the north-west coast's personal names belong to clans and go with rank (passed down, not made up), so the folk are known by their moiety, Raven or Eagle
  shallow: ["Sari", "Budi", "Dewi", "Agus", "Wulan", "Hadi", "Ratna", "Joko", "Indah", "Bayu", "Lestari", "Eko", "Ayu"],
  arctic: ["Aput", "Siku", "Nuka", "Tulugaq", "Ilannaq", "Pilu", "Qilak", "Ukaliq", "Aklaq", "Nanuq", "Tupaarnaq", "Kallik", "Miki"],
  therans: ["Ariadne", "Minos", "Phaistia", "Rhadamanthys", "Kydonia", "Idomeneus", "Pasiphae", "Deukalion", "Akrotira", "Talos", "Europa", "Glaukos", "Thera"],
};
export const nameOf = (tradition, k) => { const L = NAMES[tradition] ?? NAMES.european; return L[Math.floor(golden(k) * L.length)]; };
