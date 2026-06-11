import React, { useState, useMemo } from 'react';

import { analyzeTextOffline } from '../../../../aiService';
import {
  collectExternalMediaUrls,
  inlineExternalMediaForActivity,
} from '../../../../utils/scormMediaInline';
import {
  enforceTtkbActivityCompliance,
  enforceTtkbObjectCompliance,
  findTtkbMissingSemanticIconButtons,
  hasTtkbSingleLineButtonRisk,
  parseCssColorSamples,
  relativeLuminance,
  contrastRatio,
} from '../../../../utils/ttkbCompliance';

import {
  PanelShell,
  PanelCard,
  MetricGrid,
} from './PanelPrimitives';

export default function TtkbComplianceRightPanel({ controller, onClose }) {
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [fixedItems, setFixedItems] = useState([]);

  const addFixedItems = (items) => {
    setFixedItems((previous) => {
      const previousKeys = new Set(previous.map((item) => `${item.type}:${item.id}`));
      return [
        ...previous,
        ...items.filter((item) => !previousKeys.has(`${item.type}:${item.id}`)),
      ];
    });
  };

  // Single Object Auto-Fix Action
  const handleFixSingleObject = (obj) => {
    if (!controller?.onUpdateActivity || !controller?.activity) return;
    const activity = controller.activity;
    const compliantObj = enforceTtkbObjectCompliance(obj, activity, controller.objects || []);
    if (JSON.stringify(obj) === JSON.stringify(compliantObj)) {
      controller.showToast?.('Bu nesnede uygulanabilir otomatik değişiklik bulunamadı.', 'info');
      return;
    }
    
    const updatedSlides = (activity.slides || []).map(slide => {
      const hasObject = (slide.objects || []).some(o => o.id === obj.id);
      if (!hasObject) return slide;
      return {
        ...slide,
        objects: (slide.objects || []).map(o => o.id === obj.id ? compliantObj : o)
      };
    });
    
    const updatedBaseObjects = (activity.objects || []).map(o => o.id === obj.id ? compliantObj : o);
    
    const updatedActivity = {
      ...activity,
      objects: updatedBaseObjects,
      slides: updatedSlides
    };
    
    controller.onUpdateActivity(updatedActivity);
    addFixedItems([{ id: obj.id, label: obj.label || obj.name || 'Nesne', type: 'object' }]);
    
    if (controller.showToast) {
      controller.showToast(`"${obj.label || obj.name || 'Nesne'}" başarıyla düzeltildi!`, 'success');
    }
  };

  // Layer Isolation Dim Auto-Fix Action
  const handleFixLayerIsolation = () => {
    if (!controller?.onUpdateActivity || !controller?.activity) return;
    if (Number(controller.activity.answerLayerDimOpacity) >= 0.05) {
      controller.showToast?.('Katman izolasyonu zaten uygun değerde.', 'info');
      return;
    }
    const updatedActivity = {
      ...controller.activity,
      answerLayerDimOpacity: 0.07
    };
    controller.onUpdateActivity(updatedActivity);
    addFixedItems([{ id: 'popup-leak', label: 'Katman İzolasyonu', type: 'layer' }]);
    if (controller.showToast) {
      controller.showToast('Katman izolasyon dim maskesi standarda (0.07) ayarlandı!', 'success');
    }
  };

  // 1. Nesne ve Katman Seçim İşleyicileri
  const handleSelectObject = (object) => {
    if (!object || !object.id) return;
    controller.onSelectionChange?.(new Set([object.id]));
    controller.onUpdateActivity?.({
      ...(controller.activity || {}),
      activeLayerId: object.layerId || 'base',
      selectedObjectId: object.id,
    });
    if (controller.showToast) {
      controller.showToast(`"${object.label || object.name || 'Nesne'}" seçildi ve odaklandı.`, 'info');
    }
  };

  const handleSelectLayer = (layer) => {
    if (!layer || !layer.id) return;
    controller.onUpdateActivity?.({
      ...(controller.activity || {}),
      activeLayerId: layer.id,
      selectedObjectId: null,
    });
    controller.onSelectionChange?.(new Set());
    if (controller.showToast) {
      controller.showToast(`"${layer.name || 'Katman'}" katmanına geçiş yapıldı.`, 'info');
    }
  };

  // 2. Deterministik Denetim Hesaplamaları
  const auditResults = useMemo(() => {
    const activity = controller?.activity || {};
    const objects = controller?.objects || [];
    const checks = [];

    // A. Kontrast Kontrolü
    const lowContrastObjects = objects.filter((obj) => {
      if (obj.type !== 'button' && obj.type !== 'text') return false;
      const style = obj.style || {};
      const localBg = style.background;
      const hasBg = localBg && localBg !== 'transparent' && localBg !== 'none' && !localBg.includes('rgba(0,0,0,0)');
      const bgHex = hasBg ? localBg : (activity.backgroundColor || '#ffffff');
      const bg = parseCssColorSamples(bgHex);
      const fg = parseCssColorSamples(style.color || '#000000');
      if (bg.length && fg.length) {
        const avg = bg.reduce((sum, item) => sum + relativeLuminance(item), 0) / bg.length;
        const sample = bg.reduce(
          (selected, item) =>
            Math.abs(relativeLuminance(item) - avg) < Math.abs(relativeLuminance(selected) - avg)
              ? item
              : selected,
          bg[0]
        );
        return contrastRatio(sample, fg[0]) < 4.5;
      }
      return false;
    });

    checks.push({
      id: 'contrast',
      title: 'Erişilebilir Kontrast (WCAG)',
      desc: 'Metin ve butonlarda yazı rengi kontrastı en az 4.5:1 olmalıdır.',
      status: lowContrastObjects.length ? 'danger' : 'success',
      count: lowContrastObjects.length,
      detail: lowContrastObjects.length
        ? `${lowContrastObjects.length} nesnede kontrast riski var.`
        : 'Tüm metin ve butonlar yüksek kontrastlı ve okunabilir.',
      fixable: true,
      objects: lowContrastObjects,
    });

    // B. Buton Etiket ve Taşma Kontrolü
    const longButtonLabels = objects.filter(hasTtkbSingleLineButtonRisk);

    checks.push({
      id: 'button-length',
      title: 'Buton Tek Satır Kontrolü',
      desc: 'Buton etiketleri tek satırda ve sığacak uzunlukta olmalıdır.',
      status: longButtonLabels.length ? 'warning' : 'success',
      count: longButtonLabels.length,
      detail: longButtonLabels.length
        ? `${longButtonLabels.length} butonda çoklu satır veya kırpılma riski.`
        : 'Tüm buton etiketleri tek satırda sığıyor.',
      fixable: true,
      objects: longButtonLabels,
    });

    // C. Semantik İkon Doğrulaması
    const missingIcons = findTtkbMissingSemanticIconButtons(objects);

    checks.push({
      id: 'semantic-icons',
      title: 'MEB Semantik İkonlar',
      desc: 'Kritik butonlarda MEB standartlarında kararlı semantik ikonlar yer almalıdır.',
      status: missingIcons.length ? 'warning' : 'success',
      count: missingIcons.length,
      detail: missingIcons.length
        ? `${missingIcons.length} butonda semantik ikon eksik.`
        : 'Gerekli semantik ikonlar tanımlanmış.',
      fixable: true,
      objects: missingIcons,
    });

    // D. Dış Bağlantılar (KVKK / Telif Güvenliği)
    // Gömülebilir medya (mediaUrl/imageData/can simgesi vb. http) ile gerçek web
    // bağlantıları AYRILIR: medya "Auto-Fix" ile projeye data URL olarak gömülür
    // (çevrimdışı SCORM); web embed yalnızca uyarı olarak kalır.
    const inlineableMediaUrls = new Set(
      collectExternalMediaUrls(controller?.activity || { objects })
    );
    const externalLinks = [];
    const externalLinkObjects = [];
    objects.forEach((obj) => {
      const text = JSON.stringify(obj);
      const matches = text.match(/https?:\/\/[^\s"']+/g);
      if (matches) {
        matches.forEach((url) => {
          if (inlineableMediaUrls.has(url)) return;
          if (!externalLinks.includes(url)) {
            externalLinks.push(url);
          }
          if (!externalLinkObjects.some(o => o.id === obj.id)) {
            externalLinkObjects.push(obj);
          }
        });
      }
    });

    checks.push({
      id: 'external-media',
      title: 'Gömülebilir Harici Medya',
      desc: 'Sunucudan yüklenen medya çevrimdışı çalışma için pakete gömülmelidir.',
      status: inlineableMediaUrls.size ? 'warning' : 'success',
      count: inlineableMediaUrls.size,
      detail: inlineableMediaUrls.size
        ? `${inlineableMediaUrls.size} medya dosyası internetten yükleniyor — "Otomatik Onar" ile projeye gömülür.`
        : 'Tüm medya proje içinde gömülü; çevrimdışı çalışır.',
      fixable: true,
      objects: [],
    });

    checks.push({
      id: 'external-links',
      title: 'Harici Bağlantı Denetçisi',
      desc: 'KVKK ve telif riski oluşturan dış HTTP/HTTPS linkleri (web embed vb.).',
      status: externalLinks.length ? 'warning' : 'success',
      count: externalLinks.length,
      detail: externalLinks.length
        ? `${externalLinks.length} dış bağlantı saptandı (SCORM öncesi kontrol edin).`
        : 'Herhangi bir harici bağlantı saptanmadı.',
      fixable: false,
      objects: externalLinkObjects,
    });

    // E. Katman İzolasyon Kontrolü
    const popups = controller?.layers?.filter((l) => l.kind !== 'base') || [];
    const badPopups = popups.filter(
      () =>
        activity.answerLayerDimOpacity === undefined ||
        Number(activity.answerLayerDimOpacity) < 0.05
    );

    checks.push({
      id: 'popup-leak',
      title: 'Katman İzolasyonu',
      desc: 'Pop-up pencerelerin alt katmana tıklama ve imleç sızdırmasını engelleme.',
      status: badPopups.length ? 'warning' : 'success',
      count: badPopups.length,
      detail: badPopups.length
        ? 'Katman arka plan dim maskesi standart değerin (en az 0.05) altında.'
        : 'Katman arka plan dim maskesi sızdırmazlık standartlarına uygun.',
      fixable: true,
      layers: badPopups,
    });

    return checks;
  }, [controller]);

  // 3. Tek Tıkla Otomatik Onarım (Auto-Fix)
  const handleAutoFix = async () => {
    if (!controller?.onUpdateActivity || !controller?.activity) return;
    const originalActivity = controller.activity;
    const needsLayerFix =
      originalActivity.answerLayerDimOpacity === undefined ||
      Number(originalActivity.answerLayerDimOpacity) < 0.05;
    let compliantActivity = {
      ...enforceTtkbActivityCompliance(originalActivity),
      ...(needsLayerFix ? { answerLayerDimOpacity: 0.07 } : {}),
    };

    // Harici medya: internetten yüklenen dosyaları projeye (data URL) göm —
    // SCORM paketi ve önizleme çevrimdışı ortamda da çalışsın.
    let inlinedCount = 0;
    if (collectExternalMediaUrls(compliantActivity).length) {
      const { activity: inlinedActivity, inlined, failed } =
        await inlineExternalMediaForActivity(compliantActivity);
      compliantActivity = inlinedActivity;
      inlinedCount = inlined.length;
      if (failed.length) {
        controller.showToast?.(
          `${failed.length} medya dosyası indirilemedi (ağ/CORS) — internet adresiyle kaldı.`,
          'warning'
        );
      }
    }

    // Find which objects were actually modified and add them to fixed items
    const newlyFixed = [];
    const originalObjects = [
      ...(originalActivity.objects || []),
      ...(originalActivity.slides || []).flatMap(s => s.objects || [])
    ];
    const fixedObjects = [
      ...(compliantActivity.objects || []),
      ...(compliantActivity.slides || []).flatMap(s => s.objects || [])
    ];

    fixedObjects.forEach((fObj) => {
      const orig = originalObjects.find(o => o.id === fObj.id);
      if (orig && JSON.stringify(orig) !== JSON.stringify(fObj)) {
        newlyFixed.push({ id: fObj.id, label: fObj.label || fObj.name || 'Nesne', type: 'object' });
      }
    });

    if (needsLayerFix) {
      newlyFixed.push({ id: 'popup-leak', label: 'Katman İzolasyonu', type: 'layer' });
    }

    if (inlinedCount > 0) {
      newlyFixed.push({
        id: 'external-media',
        label: `${inlinedCount} medya pakete gömüldü (çevrimdışı)`,
        type: 'media',
      });
    }

    if (newlyFixed.length > 0) {
      controller.onUpdateActivity(compliantActivity);
      addFixedItems(newlyFixed);
      controller.showToast?.(
        `${newlyFixed.length} TTKB düzeltmesi uygulandı. Sonuçlar listelendi.`,
        'success'
      );
    } else {
      controller.showToast?.('Otomatik uygulanabilir yeni bir düzeltme bulunamadı.', 'info');
    }
  };

  // 4. Yapay Zeka Destekli Pedagojik Analiz
  const handleAiAnalysis = async () => {
    setAiAnalyzing(true);
    setAiResult(null);
    try {
      const textContent = (controller?.objects || [])
        .filter((obj) => obj.type === 'text' || obj.type === 'button')
        .map((obj) => obj.text || obj.label || '')
        .filter(Boolean)
        .join('\n');

      if (!textContent.trim()) {
        setAiResult({
          status: 'success',
          analysis: 'Sahnede analiz edilecek anlamlı metin bulunamadı. Lütfen metin veya buton ekleyin.',
        });
        return;
      }

      const res = await analyzeTextOffline(
        textContent,
        'Bu metin MEB TTKB standartlarına göre pedagojik yaş uyumu, dil bilgisi kuralları ve üslup açısından analiz edilecektir.'
      );
      setAiResult({
        status: 'success',
        analysis: res.analysis,
        source: res.source,
      });
    } catch (err) {
      setAiResult({
        status: 'danger',
        analysis: 'AI analizi başlatılamadı: ' + err.message,
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const dangerCount = auditResults.filter((c) => c.status === 'danger').length;
  const warningCount = auditResults.filter((c) => c.status === 'warning').length;
  const fixableCount = auditResults.filter((c) => c.status !== 'success' && c.fixable).length;

  return (
    <PanelShell
      title="TTKB Uyum Denetçisi"
      subtitle="Hibrit Kural & Çevrimdışı AI Erişilebilirlik Raporu"
      action={
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 'bold',
            padding: '2px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      }
    >
      {/* 1. Özet Panel */}
      <MetricGrid
        columns={3}
        items={[
          { label: 'Kritik Hata', value: dangerCount, tone: dangerCount ? '#ef4444' : '#16a34a' },
          { label: 'Uyarı', value: warningCount, tone: warningCount ? '#f59e0b' : '#16a34a' },
          { label: 'Düzeltilebilir', value: fixableCount, tone: '#3b82f6' },
        ]}
      />

      {/* 2. Hızlı Aksiyon (Auto-Fix) */}
      {fixableCount > 0 && (
        <div style={{ marginTop: 5 }}>
          <button
            type="button"
            onClick={handleAutoFix}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: 11,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
            }}
          >
            ✦ TÜMÜNÜ OTOMATİK ONAR (AUTO-FIX)
          </button>
        </div>
      )}

      {/* 2.5. Düzeltilen Ögeler Listesi */}
      {fixedItems.length > 0 && (
        <PanelCard title="✓ Düzeltilen Ögeler" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fixedItems.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontSize: 10,
                  fontWeight: 750
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ color: '#10b981', fontWeight: 900 }}>✓</span>
                  {item.label}
                </span>
                <span style={{ fontSize: 9, color: '#047857', background: '#d1fae5', padding: '1px 5px', borderRadius: 4 }}>
                  DÜZELTİLDİ
                </span>
              </div>
            ))}
          </div>
        </PanelCard>
      )}

      {/* 3. Deterministik Denetim Listesi */}
      <PanelCard title="1. Teknik & Erişilebilirlik Denetimleri" defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {auditResults.map((check) => (
            <div
              key={check.id}
              style={{
                border: `1px solid ${
                  check.status === 'success'
                    ? '#cbd5e1'
                    : check.status === 'danger'
                      ? '#fee2e2'
                      : '#fef3c7'
                }`,
                borderRadius: 8,
                background:
                  check.status === 'success'
                    ? '#f8fafc'
                    : check.status === 'danger'
                      ? '#fef2f2'
                      : '#fffbeb',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11.5, fontWeight: 900, color: '#1e293b' }}>
                  {check.title}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    padding: '2px 6px',
                    borderRadius: 99,
                    color:
                      check.status === 'success'
                        ? '#15803d'
                        : check.status === 'danger'
                          ? '#b91c1c'
                          : '#b45309',
                    background:
                      check.status === 'success'
                        ? '#dcfce7'
                        : check.status === 'danger'
                          ? '#fee2e2'
                          : '#fef3c7',
                  }}
                >
                  {check.status === 'success' ? 'UYUMLU ✓' : check.status === 'danger' ? 'HATA ✕' : 'UYARI !'}
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#64748b' }}>{check.desc}</span>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 10.5,
                  fontWeight: 750,
                  color:
                    check.status === 'success'
                      ? '#166534'
                      : check.status === 'danger'
                        ? '#991b1b'
                        : '#92400e',
                  borderTop: '1px dashed rgba(0,0,0,0.06)',
                  paddingTop: 4,
                }}
              >
                {check.detail}
              </div>

              {/* İlgili Nesnelerin Listelenmesi ve Odaklanma Arayüzü */}
              {check.status !== 'success' && check.objects && check.objects.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    marginTop: 6,
                    borderTop: '1px solid rgba(0,0,0,0.04)',
                    paddingTop: 6,
                  }}
                >
                  <div style={{ fontSize: 9.5, fontWeight: 900, color: '#64748b', marginBottom: 1 }}>
                    İLGİLİ NESNELER (Odaklanmak için Tıklayın):
                  </div>
                  {check.objects.map((obj) => (
                    <div
                      key={obj.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectObject(obj)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          background: '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#192a3e',
                          boxShadow: '0 1px 2px rgba(0,0,0,.03)',
                          transition: 'all 0.12s ease',
                          flex: 1,
                          minWidth: 0
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = '#93c5fd';
                          e.currentTarget.style.background = '#f0f7ff';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#3b82f6', fontWeight: 900 }}>◉</span>
                          {obj.label || obj.name || obj.id || 'İsimsiz Nesne'}
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 900,
                            color: '#475569',
                            background: '#f1f5f9',
                            padding: '1px 5px',
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        >
                          {obj.type === 'button' ? 'BUTON' : 'METİN'}
                        </span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleFixSingleObject(obj)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 24,
                          padding: '0 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#10b981',
                          color: '#ffffff',
                          fontSize: 9,
                          fontWeight: 900,
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(16,185,129,0.2)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#059669';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#10b981';
                        }}
                      >
                        Düzelt
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Katman İzolasyonundaki Hatalı Katmanların Listelenmesi */}
              {check.status !== 'success' && check.id === 'popup-leak' && check.layers && check.layers.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    marginTop: 6,
                    borderTop: '1px solid rgba(0,0,0,0.04)',
                    paddingTop: 6,
                  }}
                >
                  <div style={{ fontSize: 9.5, fontWeight: 900, color: '#64748b', marginBottom: 1 }}>
                    İLGİLİ KATMANLAR (Katmana Gitmek için Tıklayın):
                  </div>
                  {check.layers.map((layer) => (
                    <div
                      key={layer.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectLayer(layer)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          background: '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#192a3e',
                          boxShadow: '0 1px 2px rgba(0,0,0,.03)',
                          transition: 'all 0.12s ease',
                          flex: 1,
                          minWidth: 0
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = '#f59e0b';
                          e.currentTarget.style.background = '#fffbeb';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#f59e0b', fontWeight: 900 }}>⧉</span>
                          {layer.name || layer.id || 'İsimsiz Katman'}
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 900,
                            color: '#d97706',
                            background: '#fef3c7',
                            padding: '1px 5px',
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        >
                          KATMAN
                        </span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleFixLayerIsolation}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 24,
                          padding: '0 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#f59e0b',
                          color: '#ffffff',
                          fontSize: 9,
                          fontWeight: 900,
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(245,158,11,0.2)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#d97706';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#f59e0b';
                        }}
                      >
                        Düzelt
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </PanelCard>

      {/* 4. AI Destekli Dil ve Pedagoji Denetimi */}
      <PanelCard title="2. Yapay Zeka Pedagojik Raporu" defaultOpen={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
            Yerel yapay zeka motoru, sahnedeki tüm metinleri analiz ederek MEB müfredat hedeflerine, dil bilgisi standartlarına ve pedagojik üsluba uyumluluğu kontrol eder.
          </span>

          <button
            type="button"
            onClick={handleAiAnalysis}
            disabled={aiAnalyzing}
            style={{
              height: 32,
              borderRadius: 7,
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontWeight: 900,
              fontSize: 10.5,
              cursor: aiAnalyzing ? 'not-allowed' : 'pointer',
            }}
          >
            {aiAnalyzing ? '✦ YAPAY ZEKA ANALİZ EDİYOR...' : '✦ AI İLE PEDAGOJİK & DİL DENETİMİ BAŞLAT'}
          </button>

          {aiResult && (
            <div
              style={{
                border: `1px solid ${aiResult.status === 'danger' ? '#fee2e2' : '#dbeafe'}`,
                borderRadius: 8,
                background: aiResult.status === 'danger' ? '#fef2f2' : '#f0f7ff',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                  paddingBottom: 4,
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 900, color: '#1e3a8a' }}>
                  AI Analiz Sonucu
                </span>
                <span style={{ fontSize: 9, color: '#2563eb', fontWeight: 800 }}>
                  Kaynak: {aiResult.source || 'Offline Engine'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                {aiResult.analysis}
              </div>
            </div>
          )}
        </div>
      </PanelCard>
    </PanelShell>
  );
}
