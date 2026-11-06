# LUCH website

Bilingual human-first product experience: start with what people want to do, not with a list of AI infrastructure.

- The 32 public HTML pages are generated from [build_experience.py](build_experience.py).
- [experience.css](assets/experience.css) defines the responsive shared visual language; [experience.js](assets/experience.js) handles accessible mobile navigation.
- The effective Privacy Policy and Terms of Use, security, support, and detailed technical guide retain their source contents under /privacy/, /terms/, /security/, /support/, and /docs/get-started/.
- Historic assets remain for rollback compatibility. The new pages use experience.css / experience.js.

Build: python3 website/build_experience.py.

Do not confuse a successful static-site build with verified fresh-user onboarding. When publishing, keep the downloadable preview ZIP from the existing deployed site, back up production, and inspect the live pages.
