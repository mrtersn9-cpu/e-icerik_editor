import {
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  FileUp,
  FolderOpen,
  Layers3,
  ListFilter,
  PackagePlus,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { generateDiceBirdDemoTemplate } from '../../activity-types/custom-interaction/customInteractionTemplates';
import {
  ANSWER_LAYER_STYLE_PRESETS,
  BUTTON_PACKAGES,
  CUSTOM_INTERACTION_TEMPLATES,
  DEFAULT_ACTIVITY_CREATE_PRESET_ID,
  DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID,
  OTHER_ACTIVITY_CREATE_PRESETS,
  STANDARD_ACTIVITY_CREATE_PRESETS,
} from '../../constants';
import {
  cloneActivityForDuplicate,
  getActivityLayers,
  getActivitySlides,
  selectActivitySlide,
} from '../../logic/activityHelpers';
import {
  ensureStandardActivityScaffold,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
} from '../../logic/activityTemplateGenerators';
import {
  getButtonPackageMotion,
  getReadyButtonStyleOptions,
  restyleAllButtonsForPackage,
  restyleAnswerLayerObjectsForPreset,
} from '../../logic/buttonStyling';
import { buildResolvedLayerNameMap, createActivity as createBaseActivityFactory } from '../../logic/factories';
import { normalizeSlide } from '../../logic/slideNormalization';
import PdfCleanStudio from '../../PdfCleanStudio';
import { exportActivityToJSON, importActivityFromJSON } from '../../utils/activityImportExport';
import { getActivityProgressSummary, resolveWorkflowStatusMeta, uid } from '../../utils/editorHelpers';
import { createPdfIntegratedActivitySet } from '../../utils/pdfActivityIntegration';
import { parseAndValidateWidgetZip } from '../../widgets/widgetZipParser';
import useBackDismissible from '../navigation/useBackDismissible';

import {
  canDeleteBook,
  canDeletePublisher,
  countBookActivities,
  countPublisherActivities,
  countPublisherBooks,
  filterAndSortLibraryItems,
} from './libraryUtils';
import styles from './LibraryWorkspace.module.css';

const ACTIVITY_CREATE_PRESETS = [
  ...STANDARD_ACTIVITY_CREATE_PRESETS,
  ...OTHER_ACTIVITY_CREATE_PRESETS,
  { id: 'custom-interaction', activityType: 'custom-interaction', label: 'Özel Etkileşim Oluştur' },
];

function findActivityCreatePreset(presetId) {
  return (
    ACTIVITY_CREATE_PRESETS.find((preset) => preset.id === presetId) ||
    ACTIVITY_CREATE_PRESETS.find((preset) => preset.id === DEFAULT_ACTIVITY_CREATE_PRESET_ID) ||
    ACTIVITY_CREATE_PRESETS[0]
  );
}

function patchCurrentSlide(activity = {}, patch = {}) {
  const slides = Array.isArray(activity.slides)
    ? activity.slides.map((slide) => (slide.id === activity.currentSlideId ? { ...slide, ...patch } : slide))
    : activity.slides;
  return { ...activity, ...patch, slides };
}

function applyActivityCreatePreset(activity = {}, preset = {}, customTemplate = null) {
  if (preset.id === 'true-false') {
    return patchCurrentSlide(activity, {
      mcQuestion: activity.mcQuestion || 'Aşağıdaki ifadenin doğruluğunu seçiniz.',
      mcMode: 'single',
      mcOptions: [
        { id: uid(), label: 'Doğru', isCorrect: true },
        { id: uid(), label: 'Yanlış', isCorrect: false },
      ],
    });
  }

  if (preset.activityType === 'custom-interaction') {
    const template = customTemplate || CUSTOM_INTERACTION_TEMPLATES[0];
    if (template?.id === 'dice-animation') return generateDiceBirdDemoTemplate(activity);
    return {
      ...activity,
      customInteraction: {
        templateId: template?.id || DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID,
        templateName: template?.label || 'Boş Özel Etkileşim',
        widgets: [],
        settings: { zipImportReady: false, runtimeReady: false },
        events: [],
        commands: [],
        variables: [],
        triggers: [],
        test: { status: 'not-run' },
      },
    };
  }

  return activity;
}

function applyBookDefaultsToActivity(activity = {}, selectedBook = null) {
  const buttonPackageId = selectedBook?.buttonPackageId || activity.buttonPackageId || BUTTON_PACKAGES[0]?.id || '';
  const buttonPackage = BUTTON_PACKAGES.find((item) => item.id === buttonPackageId) || BUTTON_PACKAGES[0] || {};
  const answerLayerStylePresetId =
    selectedBook?.defaultAnswerLayerStylePresetId ||
    activity.answerLayerStylePresetId ||
    ANSWER_LAYER_STYLE_PRESETS[0]?.id ||
    '';
  const scaffoldedActivity = ensureStandardActivityScaffold(
    { ...activity, buttonPackageId, answerLayerStylePresetId },
    { select: SCENE_TEMPLATE_LAUNCH_PAGE_ID }
  );
  const slides = getActivitySlides(scaffoldedActivity);
  const currentSlideId = scaffoldedActivity.currentSlideId || slides[0]?.id || '';
  const motion = getButtonPackageMotion(buttonPackageId) || getButtonPackageMotion(buttonPackage?.id) || null;
  const buttonStyleOptions = getReadyButtonStyleOptions(scaffoldedActivity);
  const nextSlides = slides.map((slide, index) => {
    const layers = getActivityLayers(slide);
    const resolvedNames = buildResolvedLayerNameMap(layers, slide);
    const objects = restyleAnswerLayerObjectsForPreset(
      restyleAllButtonsForPackage(slide.objects || [], buttonPackageId, buttonStyleOptions).map((object) =>
        object?.type === 'button' && motion ? { ...object, buttonMotion: { ...motion } } : object
      ),
      layers,
      resolvedNames,
      answerLayerStylePresetId,
      buttonStyleOptions
    );
    return normalizeSlide({ ...slide, answerLayerStylePresetId, objects }, index);
  });
  return selectActivitySlide(
    {
      ...scaffoldedActivity,
      buttonPackageId,
      buttonAnimationProfileId:
        scaffoldedActivity.buttonAnimationProfileId || buttonPackage?.animationProfileId || 'calmLift',
      answerLayerStylePresetId,
      slides: nextSlides,
      currentSlideId,
      startSlideId: nextSlides[0]?.id || scaffoldedActivity.startSlideId || '',
    },
    currentSlideId
  );
}

function LightDialog({ title, eyebrow, onClose, width = 440, children }) {
  return (
    <div className={styles.dialogOverlay} role="presentation">
      <section
        className={styles.dialog}
        style={{ width: `min(${width}px, 100%)` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className={styles.dialogHeader}>
          <div>
            {eyebrow && <span className={styles.dialogEyebrow}>{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className={styles.dialogClose} type="button" onClick={onClose} aria-label="Kapat">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function LightField({ label, value, onChange, placeholder }) {
  return (
    <label className={styles.lightField}>
      <span>{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}

function LightButton({ children, onClick, disabled = false, variant = 'secondary' }) {
  return (
    <button
      className={`${styles.lightButton} ${variant === 'primary' ? styles.lightButtonPrimary : ''}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ToolbarButton({ icon: Icon, label, onClick, disabled = false, title }) {
  return (
    <button className={styles.toolbarButton} type="button" onClick={onClick} disabled={disabled} title={title || label}>
      <Icon size={15} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function ColumnToolbar({ search, onSearchChange, sortBy, onSortChange, addLabel, onAdd, disabled }) {
  return (
    <div className={styles.columnToolbar}>
      <label className={styles.search}>
        <Search size={14} aria-hidden="true" />
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Ara..." />
        {search && (
          <button type="button" onClick={() => onSearchChange('')} title="Aramayı temizle">
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </label>
      <label className={styles.sort}>
        <ListFilter size={14} aria-hidden="true" />
        <select value={sortBy} onChange={(event) => onSortChange(event.target.value)} title="Sıralama">
          <option value="name">A-Z</option>
          <option value="count-desc">Çoktan aza</option>
          <option value="count-asc">Azdan çoğa</option>
        </select>
      </label>
      <button className={styles.addButton} type="button" onClick={onAdd} disabled={disabled} title={addLabel}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function LibraryRow({
  item,
  icon: Icon,
  kind,
  countLabel,
  meta,
  selected,
  focused,
  onSelect,
  onOpen,
  onEdit,
  onDelete,
  onDuplicate,
}) {
  const active = Boolean(selected || focused);

  return (
    <div className={`${styles.row} ${active ? styles.rowActive : ''}`}>
      <button
        className={styles.rowMain}
        type="button"
        onClick={onSelect}
        onDoubleClick={onOpen}
        aria-pressed={active}
      >
        <span className={styles.rowIcon}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className={styles.rowCopy}>
          <strong>{item.name}</strong>
          <small>{meta || kind}</small>
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.rowCount}>{countLabel}</span>
          {active && (
            <span className={styles.rowActiveBadge}>
              <CheckCircle2 size={13} aria-hidden="true" />
              Seçili
            </span>
          )}
        </span>
        <ChevronRight className={styles.rowChevron} size={15} aria-hidden="true" />
      </button>
      <div className={styles.rowActions}>
        {onDuplicate && (
          <button type="button" onClick={() => onDuplicate(item)} title="Kopyala">
            <Copy size={14} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={() => onEdit(item)} title="Düzenle">
          <Edit3 size={14} aria-hidden="true" />
        </button>
        <button type="button" className={styles.deleteAction} onClick={() => onDelete(item)} title="Sil">
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function LibraryColumn({ title, icon: Icon, count, toolbar, emptyText, guide, children, className = '', active = false }) {
  return (
    <section className={`${styles.column} ${active ? styles.columnActive : ''} ${className}`}>
      <header className={styles.columnHeader}>
        <span className={styles.columnTitleIcon}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{guide || `${count} kayıt`}</p>
        </div>
        <span className={styles.columnCount}>{count}</span>
      </header>
      {toolbar}
      <div className={styles.list}>
        {children || (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <FolderOpen size={22} aria-hidden="true" />
            </div>
            <span>{emptyText}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default function LibraryWorkspace({
  publishers,
  books,
  activities,
  selectedPublisherId,
  selectedBookId,
  mobileColumn = 'publishers',
  onNavigateBack = () => {},
  onSelectPublisher,
  onSelectBook,
  onOpenActivity,
  registerBackDismissible,
  onPublishersChange,
  onBooksChange,
  onActivitiesChange,
  normalizeBook,
  createActivity,
  notify,
}) {
  const [focusedActivityId, setFocusedActivityId] = useState('');
  const [searches, setSearches] = useState({ publishers: '', books: '', activities: '' });
  const [sorts, setSorts] = useState({ publishers: 'name', books: 'name', activities: 'name' });
  const [dialog, setDialog] = useState(null);
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [termDraft, setTermDraft] = useState('');
  const [bookStyleId, setBookStyleId] = useState(ANSWER_LAYER_STYLE_PRESETS[0]?.id || '');
  const [activityPresetId, setActivityPresetId] = useState(DEFAULT_ACTIVITY_CREATE_PRESET_ID);
  const [customTemplateId, setCustomTemplateId] = useState(DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID);
  const importRef = useRef(null);

  const selectedPublisher = publishers.find((publisher) => publisher.id === selectedPublisherId) || null;
  const selectedBook = books.find((book) => book.id === selectedBookId) || null;
  const focusedActivity = activities.find((activity) => activity.id === focusedActivityId) || null;
  const publisherBooks = books.filter((book) => book.publisherId === selectedPublisherId);
  const bookActivities = activities.filter((activity) => activity.bookId === selectedBookId);

  const visiblePublishers = useMemo(
    () =>
      filterAndSortLibraryItems(publishers, {
        search: searches.publishers,
        sortBy: sorts.publishers,
        getChildCount: (publisher) => countPublisherBooks(books, publisher.id),
      }),
    [books, publishers, searches.publishers, sorts.publishers]
  );
  const visibleBooks = useMemo(
    () =>
      filterAndSortLibraryItems(publisherBooks, {
        search: searches.books,
        sortBy: sorts.books,
        getChildCount: (book) => countBookActivities(activities, book.id),
      }),
    [activities, publisherBooks, searches.books, sorts.books]
  );
  const visibleActivities = useMemo(
    () =>
      filterAndSortLibraryItems(bookActivities, {
        search: searches.activities,
        sortBy: sorts.activities,
        getChildCount: (activity) => getActivitySlides(activity).length,
      }),
    [bookActivities, searches.activities, sorts.activities]
  );

  const updateSearch = (key, value) => setSearches((current) => ({ ...current, [key]: value }));
  const updateSort = (key, value) => setSorts((current) => ({ ...current, [key]: value }));
  const closeDialog = () => {
    setDialog(null);
    setNameDraft('');
    setTermDraft('');
    setBookStyleId(ANSWER_LAYER_STYLE_PRESETS[0]?.id || '');
    setActivityPresetId(DEFAULT_ACTIVITY_CREATE_PRESET_ID);
    setCustomTemplateId(DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID);
  };
  useBackDismissible({
    id: 'library-pdf-studio',
    open: pdfStudioOpen,
    onDismiss: () => setPdfStudioOpen(false),
    priority: 850,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'library-dialog',
    open: !!dialog,
    onDismiss: closeDialog,
    priority: 830,
    registerBackDismissible,
  });
  const openCreate = (kind) => {
    setNameDraft('');
    setTermDraft('');
    setDialog({ kind, mode: 'create' });
  };
  const openEdit = (kind, item) => {
    setNameDraft(item.name || '');
    setTermDraft(item.term || '');
    setBookStyleId(item.defaultAnswerLayerStylePresetId || ANSWER_LAYER_STYLE_PRESETS[0]?.id || '');
    setDialog({ kind, mode: 'edit', item });
  };

  const selectPublisher = async (id) => {
    await onSelectPublisher(id);
    setFocusedActivityId('');
  };
  const selectBook = async (id) => {
    const allowed = await onSelectBook(id);
    if (allowed === false) return;
    setFocusedActivityId('');
  };

  const savePublisher = () => {
    if (!nameDraft.trim()) return;
    if (dialog.mode === 'create') {
      onPublishersChange([
        ...publishers,
        { id: uid(), name: nameDraft.trim(), description: '', term: termDraft.trim() },
      ]);
    } else {
      onPublishersChange(
        publishers.map((publisher) =>
          publisher.id === dialog.item.id
            ? { ...publisher, name: nameDraft.trim(), term: termDraft.trim() }
            : publisher
        )
      );
    }
    closeDialog();
  };
  const saveBook = () => {
    if (!nameDraft.trim() || !selectedPublisherId) return;
    if (dialog.mode === 'create') {
      onBooksChange([
        ...books,
        normalizeBook({
          id: uid(),
          publisherId: selectedPublisherId,
          name: nameDraft.trim(),
          description: '',
          buttonPackageId: BUTTON_PACKAGES[0]?.id || 'pkg-1',
          defaultAnswerLayerStylePresetId: bookStyleId,
        }),
      ]);
    } else {
      onBooksChange(
        books.map((book) =>
          book.id === dialog.item.id
            ? normalizeBook({ ...book, name: nameDraft.trim(), defaultAnswerLayerStylePresetId: bookStyleId })
            : book
        )
      );
    }
    closeDialog();
  };
  const saveActivity = () => {
    if (!nameDraft.trim() || !selectedBook) return;
    if (dialog.mode === 'edit') {
      onActivitiesChange(
        activities.map((activity) =>
          activity.id === dialog.item.id ? { ...activity, name: nameDraft.trim() } : activity
        )
      );
      closeDialog();
      return;
    }
    const preset = findActivityCreatePreset(activityPresetId);
    const customTemplate =
      CUSTOM_INTERACTION_TEMPLATES.find((item) => item.id === customTemplateId) ||
      CUSTOM_INTERACTION_TEMPLATES[0];
    const created = applyActivityCreatePreset(
      applyBookDefaultsToActivity(createActivity(nameDraft.trim(), preset?.activityType || 'selection'), selectedBook),
      preset,
      customTemplate
    );
    const nextActivity = { ...created, bookId: selectedBook.id };
    onActivitiesChange([...activities, nextActivity]);
    setFocusedActivityId(nextActivity.id);
    closeDialog();
  };

  const removePublisher = async (publisher) => {
    if (!canDeletePublisher(books, publisher.id)) {
      notify('Bu yayınevine bağlı kitaplar varken silme işlemi yapılamaz.', 'warning');
      return;
    }
    onPublishersChange(publishers.filter((item) => item.id !== publisher.id));
    if (publisher.id === selectedPublisherId) await onSelectPublisher(null);
  };
  const removeBook = async (book) => {
    if (!canDeleteBook(activities, book.id)) {
      notify('Bu kitaba bağlı etkinlikler varken silme işlemi yapılamaz.', 'warning');
      return;
    }
    onBooksChange(books.filter((item) => item.id !== book.id));
    if (book.id === selectedBookId) await onSelectBook(null);
  };
  const removeActivity = (activity) => {
    onActivitiesChange(activities.filter((item) => item.id !== activity.id));
    if (activity.id === focusedActivityId) setFocusedActivityId('');
  };
  const duplicateActivity = (activity) => {
    // Sahne/nesne/katman id'lerini yeniden üretirken tetikleyici, zaman çizelgesi ve
    // sürükle-bırak eşleştirme referanslarını da yeni id'lere göre günceller
    // (bkz. src/logic/activityHelpers.js -> cloneActivityForDuplicate).
    const copy = cloneActivityForDuplicate(activity);
    copy.name = `${activity.name} (Kopya)`;
    onActivitiesChange([...activities, copy]);
    setFocusedActivityId(copy.id);
  };

  const handlePdfIntegration = useCallback(
    ({ plan }) => {
      const targetBook = books.find((book) => book.id === plan?.bookId) || selectedBook;
      if (!targetBook || !plan?.createCount) return { createdCount: 0 };
      const result = createPdfIntegratedActivitySet(plan, {
        createBaseActivity: (name) => ({
          ...applyBookDefaultsToActivity(createBaseActivityFactory(name, 'selection'), targetBook),
          bookId: targetBook.id,
        }),
      });
      onActivitiesChange([...activities, ...result.activities]);
      const lastCreated = result.activities[result.activities.length - 1];
      if (lastCreated) setFocusedActivityId(lastCreated.id);
      return { createdCount: result.activities.length };
    },
    [activities, books, onActivitiesChange, selectedBook]
  );

  const exportFocusedActivity = () => {
    if (!focusedActivity) return;
    const blob = new Blob([exportActivityToJSON(focusedActivity)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${focusedActivity.name || 'etkinlik'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importActivity = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedBook) return;
    try {
      const result = importActivityFromJSON(await file.text());
      if (!result.success) {
        notify(result.error || 'İçe aktarma başarısız.', 'warning');
        return;
      }
      const imported = { ...result.activity, bookId: selectedBook.id };
      onActivitiesChange([...activities, imported]);
      setFocusedActivityId(imported.id);
    } catch {
      notify('Dosya okunurken hata oluştu.', 'warning');
    } finally {
      event.target.value = '';
    }
  };

  const handleZipUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedBook) return;
    try {
      const result = await parseAndValidateWidgetZip(file);
      if (!result.valid) {
        notify(result.error || 'ZIP doğrulanamadı.', 'warning');
        return;
      }
      // B-312: scanWidgetSecurity dış kaynak/ağ isteği uyarılarını yutuyordu. AGENTS gereği
      // dış kaynak içeren içerik kullanıcıya bildirilmeli (SCORM çevrimdışı çalışmayabilir).
      const widgetWarnings = (result.warnings || [])
        .map((w) => (typeof w === 'string' ? w : w?.message))
        .filter(Boolean);
      if (widgetWarnings.length) {
        notify(
          `Uyarı: Bu widget ${widgetWarnings.length} dış kaynak/ağ isteği içeriyor — SCORM paketi çevrimdışı çalışmayabilir; TTKB/KVKK/telif açısından kontrol edin.`,
          'warning'
        );
      }
      const widgetId = result.manifest.id;
      const widgetName = result.manifest.name;
      const widgetInstanceId = `obj_widget_${widgetId}_${uid().slice(0, 6)}`;
      const customWidget = {
        id: widgetInstanceId,
        type: 'custom-widget',
        name: widgetName,
        label: widgetName,
        x: Math.round((Number(selectedBook.stageWidth) || 1920) * 0.3),
        y: Math.round((Number(selectedBook.stageHeight) || 1080) * 0.25),
        width: result.manifest.defaultWidth || 500,
        height: result.manifest.defaultHeight || 350,
        zIndex: 10,
        visible: true,
        layerId: 'base',
        generatedBy: 'custom-widget-zip-import',
        widget: {
          widgetId,
          widgetName,
          basePath: '',
          entry: result.manifest.entry,
          props: result.manifest.props
            ? Object.fromEntries(result.manifest.props.map((prop) => [prop.name, prop.default ?? '']))
            : {},
          blobMap: result.blobMap,
          rawAssets: result.rawAssets,
          entryUrl: result.entryUrl,
        },
        bindings: {},
      };
      const activityName = nameDraft.trim() || file.name.replace(/\.[^/.]+$/, '') || 'Özel Etkileşim';
      const created = applyBookDefaultsToActivity(createActivity(activityName, 'custom-interaction'), selectedBook);
      const slide = created.slides?.[0] || { id: uid(), name: 'Slider 1' };
      const nextSlide = normalizeSlide({ ...slide, type: 'custom-interaction', objects: [customWidget, ...(slide.objects || [])] }, 0);
      const nextActivity = {
        ...created,
        bookId: selectedBook.id,
        type: 'custom-interaction',
        slides: [nextSlide],
        currentSlideId: nextSlide.id,
        startSlideId: nextSlide.id,
        customInteraction: {
          templateId: 'custom-zip-interaction',
          templateName: 'Özel ZIP Etkileşimi',
          widgets: [customWidget.widget],
          settings: { zipImportReady: true, runtimeReady: true },
          events: (result.manifest.events || []).map((item) => ({ sourceId: widgetInstanceId, eventName: item.name })),
          commands: (result.manifest.commands || []).map((item) => ({ targetId: widgetInstanceId, command: item.name })),
          variables: [],
          triggers: [],
        },
      };
      onActivitiesChange([...activities, nextActivity]);
      setFocusedActivityId(nextActivity.id);
      closeDialog();
      notify(`"${widgetName}" yüklendi ve yeni etkinliğe eklendi.`, 'success');
    } catch (error) {
      notify(`ZIP ayrıştırılırken hata oluştu: ${error.message}`, 'warning');
    } finally {
      event.target.value = '';
    }
  };

  const activityStatus = focusedActivity ? resolveWorkflowStatusMeta(getActivityProgressSummary(focusedActivity).status) : null;

  return (
    <main className={styles.workspace}>
      {/* cosmos atmosphere layers */}
      <div className={styles.aurora + ' ' + styles.aurora1} aria-hidden="true" />
      <div className={styles.aurora + ' ' + styles.aurora2} aria-hidden="true" />
      <div className={styles.aurora + ' ' + styles.aurora3} aria-hidden="true" />
      <div className={styles.scanline} aria-hidden="true" />
      <div className={styles.gridFloor} aria-hidden="true" />

      <div className={styles.mobileBreadcrumb}>
        {mobileColumn !== 'publishers' && (
          <button type="button" onClick={onNavigateBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            Geri
          </button>
        )}
        <span>{mobileColumn === 'publishers' ? 'Yayınevleri' : mobileColumn === 'books' ? 'Kitaplar' : 'Etkinlikler'}</span>
      </div>

      <div className={styles.columns}>
        <LibraryColumn
          title="Yayınevleri"
          icon={Building2}
          count={visiblePublishers.length}
          guide="1. adım"
          active={!!selectedPublisherId}
          className={mobileColumn !== 'publishers' ? styles.mobileHidden : ''}
          emptyText="Henüz yayınevi eklenmedi."
          toolbar={
            <ColumnToolbar
              search={searches.publishers}
              onSearchChange={(value) => updateSearch('publishers', value)}
              sortBy={sorts.publishers}
              onSortChange={(value) => updateSort('publishers', value)}
              addLabel="Yeni yayınevi"
              onAdd={() => openCreate('publisher')}
            />
          }
        >
          {visiblePublishers.map((publisher) => (
            <LibraryRow
              key={publisher.id}
              item={publisher}
              icon={Building2}
              kind="Yayınevi"
              countLabel={`${countPublisherBooks(books, publisher.id)} kitap`}
              meta={
                publisher.term
                  ? `${publisher.term} · ${countPublisherActivities(books, activities, publisher.id)} etkinlik`
                  : `${countPublisherActivities(books, activities, publisher.id)} etkinlik`
              }
              selected={publisher.id === selectedPublisherId}
              onSelect={() => selectPublisher(publisher.id)}
              onEdit={(item) => openEdit('publisher', item)}
              onDelete={removePublisher}
            />
          ))}
        </LibraryColumn>

        <LibraryColumn
          title="Kitaplar"
          icon={BookOpen}
          count={visibleBooks.length}
          guide={selectedPublisher ? `${selectedPublisher.name} içindeki kitaplar` : '2. adım'}
          active={!!selectedBookId}
          className={mobileColumn !== 'books' ? styles.mobileHidden : ''}
          emptyText={selectedPublisherId ? 'Bu yayınevinde kitap bulunmuyor.' : 'Önce bir yayınevi seçin.'}
          toolbar={
            <ColumnToolbar
              search={searches.books}
              onSearchChange={(value) => updateSearch('books', value)}
              sortBy={sorts.books}
              onSortChange={(value) => updateSort('books', value)}
              addLabel="Yeni kitap"
              onAdd={() => openCreate('book')}
              disabled={!selectedPublisherId}
            />
          }
        >
          {visibleBooks.map((book) => (
            <LibraryRow
              key={book.id}
              item={book}
              icon={BookOpen}
              kind="Kitap"
              countLabel={`${countBookActivities(activities, book.id)} etkinlik`}
              meta={book.grade || book.gradeLevel || 'Ders kitabı'}
              selected={book.id === selectedBookId}
              onSelect={() => selectBook(book.id)}
              onEdit={(item) => openEdit('book', item)}
              onDelete={removeBook}
            />
          ))}
        </LibraryColumn>

        <LibraryColumn
          title="Etkinlikler"
          icon={Layers3}
          count={visibleActivities.length}
          guide={selectedBook ? `${selectedBook.name} içindeki etkinlikler` : '3. adım'}
          active={!!focusedActivityId}
          className={mobileColumn !== 'activities' ? styles.mobileHidden : ''}
          emptyText={selectedBookId ? 'Bu kitapta etkinlik bulunmuyor.' : 'Önce bir kitap seçin.'}
          toolbar={
            <ColumnToolbar
              search={searches.activities}
              onSearchChange={(value) => updateSearch('activities', value)}
              sortBy={sorts.activities}
              onSortChange={(value) => updateSort('activities', value)}
              addLabel="Yeni etkinlik"
              onAdd={() => openCreate('activity')}
              disabled={!selectedBookId}
            />
          }
        >
          {visibleActivities.map((activity) => {
            const summary = getActivityProgressSummary(activity);
            const status = resolveWorkflowStatusMeta(summary.status);
            return (
              <LibraryRow
                key={activity.id}
                item={activity}
                icon={Layers3}
                kind="Etkinlik"
                countLabel={`${getActivitySlides(activity).length} sahne`}
                meta={`${status.label} · ${activity.type || 'Etkinlik'}`}
                focused={activity.id === focusedActivityId}
                onSelect={() => setFocusedActivityId(activity.id)}
                onOpen={() => onOpenActivity(activity.id)}
                onEdit={(item) => openEdit('activity', item)}
                onDelete={removeActivity}
                onDuplicate={duplicateActivity}
              />
            );
          })}
        </LibraryColumn>
      </div>

      <footer className={styles.actionBar}>
        <div className={styles.actionContext}>
          <span
            className={
              styles.statusOrb +
              (focusedActivity ? ' ' + styles.statusOrbReady : !selectedBook ? ' ' + styles.statusOrbIdle : '')
            }
            aria-hidden="true"
          />
          <span>
            {focusedActivity
              ? `${focusedActivity.name}${activityStatus ? ` · ${activityStatus.label}` : ''}`
              : selectedBook
                ? `${selectedBook.name} kitabından bir etkinlik seçin`
                : 'PDF ve etkinlik işlemleri için kitap seçin'}
          </span>
        </div>
        <div className={styles.actionButtons}>
          <ToolbarButton icon={PackagePlus} label="PDF Stüdyo" onClick={() => setPdfStudioOpen(true)} disabled={!selectedBook} />
          <ToolbarButton icon={Upload} label="İçe Aktar" onClick={() => importRef.current?.click()} disabled={!selectedBook} />
          <ToolbarButton icon={Download} label="Dışa Aktar" onClick={exportFocusedActivity} disabled={!focusedActivity} />
          <button
            className={styles.openButton + (focusedActivity ? ' ' + styles.openButtonArmed : '')}
            type="button"
            onClick={() => focusedActivity && onOpenActivity(focusedActivity.id)}
            disabled={!focusedActivity}
          >
            <Play size={15} aria-hidden="true" />
            Editörde aç
          </button>
        </div>
        <input ref={importRef} type="file" accept=".json,application/json" onChange={importActivity} hidden />
      </footer>

      {pdfStudioOpen && (
        <PdfCleanStudio
          fullScreen
          onClose={() => setPdfStudioOpen(false)}
          integrationBook={selectedBook}
          integrationBooks={books}
          integrationActivities={activities}
          onIntegratePages={handlePdfIntegration}
          title={selectedBook ? `${selectedBook.name} PDF Düzenleme Stüdyosu` : 'PDF Düzenleme Stüdyosu'}
        />
      )}

      {dialog?.kind === 'publisher' && (
        <LightDialog
          title={dialog.mode === 'create' ? 'Yeni Yayınevi' : 'Yayınevini Düzenle'}
          eyebrow="Kütüphane kaydı"
          onClose={closeDialog}
          width={440}
        >
          <div className={styles.modalStack}>
            <LightField
              label="Yayınevi Adı"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Yayınevi adı..."
            />
            <LightField
              label="Dönem"
              value={termDraft}
              onChange={(event) => setTermDraft(event.target.value)}
              placeholder="Örn. 2025-2026 Ekim"
            />
            <div className={styles.modalActions}>
              <LightButton onClick={closeDialog}>İptal</LightButton>
              <LightButton onClick={savePublisher} variant="primary" disabled={!nameDraft.trim()}>
                Kaydet
              </LightButton>
            </div>
          </div>
        </LightDialog>
      )}

      {dialog?.kind === 'book' && (
        <LightDialog
          title={dialog.mode === 'create' ? 'Yeni Kitap' : 'Kitabı Düzenle'}
          eyebrow="Kitap ayarı"
          onClose={closeDialog}
          width={520}
        >
          <div className={styles.modalStack}>
            <LightField
              label="Kitap Adı"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Kitap adı..."
            />
            <label className={styles.modalLabel}>
              Kitap varsayılan stili
              <select value={bookStyleId} onChange={(event) => setBookStyleId(event.target.value)}>
                {ANSWER_LAYER_STYLE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
            </label>
            <div className={styles.modalActions}>
              <LightButton onClick={closeDialog}>İptal</LightButton>
              <LightButton onClick={saveBook} variant="primary" disabled={!nameDraft.trim()}>
                Kaydet
              </LightButton>
            </div>
          </div>
        </LightDialog>
      )}

      {dialog?.kind === 'activity' && (
        <LightDialog
          title={dialog.mode === 'create' ? 'Yeni Etkinlik' : 'Etkinliği Düzenle'}
          eyebrow="Etkinlik kurulumu"
          onClose={closeDialog}
          width={780}
        >
          <div className={styles.modalStack}>
            <LightField
              label="Etkinlik Adı"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Etkinlik adı..."
            />
            {dialog.mode === 'create' && (
              <>
                <div className={styles.activityCreateSection}>
                  <div className={styles.activityCreateHeader}><span>Standart Etkinlikler</span><span>Mevcut motorlarla oluşturulur</span></div>
                  <div className={styles.activityCreateGrid}>
                    {STANDARD_ACTIVITY_CREATE_PRESETS.map((preset) => (
                      <button key={preset.id} type="button" className={`${styles.activityPresetCard} ${activityPresetId === preset.id ? styles.isActive : ''}`} onClick={() => setActivityPresetId(preset.id)}>
                        <span className={styles.activityPresetIcon}>{preset.icon}</span>
                        <span className={styles.activityPresetCopy}><span className={styles.activityPresetTitle}>{preset.label}</span><span className={styles.activityPresetDesc}>{preset.desc}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.activityCreateSection}>
                  <div className={styles.activityCreateHeader}><span>Diğer Etkinlikler</span><span>Önceki akışlarla uyumlu</span></div>
                  <div className={`${styles.activityCreateGrid} ${styles.activityCreateGridCompact}`}>
                    {OTHER_ACTIVITY_CREATE_PRESETS.map((preset) => (
                      <button key={preset.id} type="button" className={`${styles.activityPresetCard} ${activityPresetId === preset.id ? styles.isActive : ''}`} onClick={() => setActivityPresetId(preset.id)}>
                        <span className={styles.activityPresetIcon}>{preset.icon}</span>
                        <span className={styles.activityPresetCopy}><span className={styles.activityPresetTitle}>{preset.label}</span><span className={styles.activityPresetDesc}>{preset.desc}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.activityCreateSection}>
                  <div className={styles.activityCreateHeader}><span>Özel Etkileşimler</span><span>Widget tabanlı akışlar</span></div>
                  <button type="button" className={`${styles.activityPresetCard} ${styles.activityPresetCardWide} ${activityPresetId === 'custom-interaction' ? styles.isActive : ''}`} onClick={() => setActivityPresetId('custom-interaction')}>
                    <span className={styles.activityPresetIcon}><PackagePlus size={17} /></span>
                    <span className={styles.activityPresetCopy}><span className={styles.activityPresetTitle}>Özel Etkileşim Oluştur</span><span className={styles.activityPresetDesc}>Hazır şablon veya ZIP yüklemesi kullanın</span></span>
                  </button>
                  {activityPresetId === 'custom-interaction' && (
                    <div className={styles.customCreateShell}>
                      <div className={styles.customTemplateGrid}>
                        {CUSTOM_INTERACTION_TEMPLATES.map((template) => (
                          <button key={template.id} type="button" className={`${styles.customTemplateCard} ${customTemplateId === template.id ? styles.isActive : ''}`} onClick={() => setCustomTemplateId(template.id)}>
                            <span>{template.icon}</span><strong>{template.label}</strong><small>{template.desc}</small>
                          </button>
                        ))}
                      </div>
                      <label className={styles.zipButton}>
                        <FileUp size={16} aria-hidden="true" />
                        ZIP ile yeni özel etkileşim yükle
                        <input type="file" accept=".zip,application/zip" onChange={handleZipUpload} hidden />
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className={styles.modalActions}>
              <LightButton onClick={closeDialog}>İptal</LightButton>
              <LightButton onClick={saveActivity} variant="primary" disabled={!nameDraft.trim()}>
                Kaydet
              </LightButton>
            </div>
          </div>
        </LightDialog>
      )}
    </main>
  );
}
