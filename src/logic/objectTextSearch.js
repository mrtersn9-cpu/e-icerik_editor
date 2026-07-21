// Etkinlik nesnelerinde ("Bul-Değiştir" ribbon aracı için) metin arama/sayma/değiştirme.
// Hem kök seviye `activity.objects` hem de çok-sahneli etkinliklerde her `activity.slides[].objects`
// üzerinde çalışır — aksi halde sahne içindeki nesnelerin metinleri sessizce atlanır.

const FIELDS = ['label', 'text'];

const countInObjects = (objects, search) =>
  (Array.isArray(objects) ? objects : []).reduce((count, item) => {
    const fields = FIELDS.map((key) => item?.[key]).filter((v) => typeof v === 'string');
    return count + fields.reduce((c, value) => c + value.split(search).length - 1, 0);
  }, 0);

export const countActivityObjectTextMatches = (activity, search) => {
  if (!activity || !search) return 0;
  const rootCount = countInObjects(activity.objects, search);
  const slideCount = (activity.slides || []).reduce(
    (count, slide) => count + countInObjects(slide?.objects, search),
    0
  );
  return rootCount + slideCount;
};

const replaceInObjects = (objects, search, replace, counter) =>
  (Array.isArray(objects) ? objects : []).map((item) => {
    let next = item;
    FIELDS.forEach((key) => {
      if (typeof next[key] === 'string' && next[key].includes(search)) {
        counter.count += next[key].split(search).length - 1;
        next = { ...next, [key]: next[key].split(search).join(replace) };
      }
    });
    return next;
  });

// Kök `objects` ve her `slides[].objects` içinde arama/değiştirme yapar.
// Dönüş: { count, objects, slides } — çağıran taraf `count > 0` ise updateActivity ile uygular.
export const replaceActivityObjectTextMatches = (activity, search, replace) => {
  if (!activity || !search) {
    return { count: 0, objects: activity?.objects || [], slides: activity?.slides || [] };
  }
  const counter = { count: 0 };
  const objects = replaceInObjects(activity.objects, search, replace, counter);
  const slides = (activity.slides || []).map((slide) => ({
    ...slide,
    objects: replaceInObjects(slide?.objects, search, replace, counter),
  }));
  return { count: counter.count, objects, slides };
};
