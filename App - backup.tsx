// App.tsx
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Alert,
  I18nManager,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// ------------------------- Config -------------------------
const ESIGN_BACKEND = 'http://192.168.68.54:8000/esign';
const APP_PIN = '2468';

// ------------------------- Types -------------------------
type Screen = 'menu' | 'editor' | 'list' | 'esign' | 'printList';

interface ContractFields {
  fullName: string;
  idNumber: string;
  companyName: string;
  companyStamp: string;
  dealType: string;
  address: string;
  approxPrice: string;
  feePerLot: string;
  date: string;
}

interface StoredContract {
  id: string;
  name: string;
  fields: ContractFields;
  createdAt: number;
  updatedAt: number;
}

// ------------------------- Data -------------------------
const DEFAULT_FIELDS: ContractFields = {
  fullName: '',
  idNumber: '',
  companyName: '',
  companyStamp: '',
  dealType: '',
  address: '',
  approxPrice: '',
  feePerLot: '',
  date: '',
};

// ------------------------- Logo helper -------------------------
async function loadLogoFileUri(): Promise<string> {
  try {
    const asset = Asset.fromModule(require('./assets/Nituv_logo.png'));
    await asset.downloadAsync(); // מבטיח localUri
    const local = asset.localUri ?? asset.uri;
    // נכניס כ-data URL כדי שיהיה יציב בדפסת PDF
    const b64 = await FileSystem.readAsStringAsync(local, { encoding: 'base64' });
    return `data:image/png;base64,${b64}`;
  } catch (e) {
    console.warn('Logo load failed:', e);
    return '';
  }
}

// ------------------------- HTML render -------------------------
function renderContractHTML(f: ContractFields, logo: string) {
  const css = `
  @page { size: A4; margin: 6mm 12mm 12mm 12mm; }
  html, body { direction: rtl; }
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, "Noto Sans Hebrew", Arial; font-size: 10pt; line-height: 1.25; color:#000; }
  .header { text-align:center; margin:0 0 1mm; }
  .header img { width:100%; height:1.63in; object-fit:contain; }
  h1 { text-align:center; margin: 1mm 0 5mm; font-size: 12pt; font-weight: 700; } /* הוקטן רק גודל הכותרת */
  .center { text-align:center; line-height:1.7; }
  .line { margin: 1.8mm 0; }
  .fill { display:inline-block; min-width: 120px; border-bottom: 1px solid #000; padding: 0 6px; }
  .clause { margin: 3mm 0; page-break-inside: avoid; }
  .between { margin: 3mm 0; }
  .signature { text-align:center; margin-top: 10mm; }
  .signature .fill { min-width: 220px; }
  .sep { display:inline-block; width: 14mm; } /* רווחים אופקיים בשורת אילן אפרים */
  `;

  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"/><style>${css}</style></head>
<body>
  <div class="header">
    ${logo ? `<img alt="Nituv Logo" src="${logo}" />` : ''}
  </div>

  <h1>הזמנת שירותי תיווך במקרקעין</h1>

  <div class="center">
    <div class="line">אני הח''מ: שם ומשפחה <span class="fill">${esc(f.fullName)}</span>     ת.ז: <span class="fill">${esc(f.idNumber)}</span></div>
    <div class="line">שם חברה: <span class="fill">${esc(f.companyName)}</span>     חתימה וחותמת: <span class="fill">${esc(f.companyStamp)}</span></div>
    <div class="line">מזמין/מזמינים בזאת שירותי תיווך במקרקעין מיועץ הנדל''ן</div>
    <div class="line">אילן אפרים<span class="sep"></span>ת.ז: 22764963<span class="sep"></span>רישיון: 25375</div>
    <div class="line">או כל מתווך מורשה שהוסמך על ידו לפעול לביצוע הזמנה זו [להלן "המתווך"]</div>
  </div>

  <div class="clause"><b>1.</b> סוג העסקה: ${esc(f.dealType)}</div>
  <div class="between">בכתובת: ${esc(f.address)}</div>
  <div class="clause"><b>2.</b> מחיר העסקה המוצע בקירוב הינו: ${esc(f.approxPrice)}</div>
  <div class="clause"><b>3.</b> אני/אנו מתחייב/מתחייבים, להודיע ולשתף את המתווך בכל התפתחות בעסקה שתתבצע ביני/ביננו, הקונה/הקונים, לבין בעלי הנכסים שהוצגו בפני/בפנינו [בין ישירות ובין ע''י צד ג']</div>
  <div class="clause"><b>4.</b> אני/אנו מתחייב/מתחייבים, לשלם למתווך את דמי התיווך מיד עם חתימת ההסכם המחייב. במקרה שאני, או שותפי את כל חברה שיש לי, או שיהיה לי בה חלק או מישהו מבני משפחתי או בא כוחי יחתום על ההסכם המחייב, או יקנה את אחד הנכסים שהוצגו לי/לנו ע''י המתווך [בין ישירות ובין ע''י צד ג']. בלא קשר לביצוע ההסכם בפועל או רישום בטאבו או לפרעון תמורת הנכס.</div>
  <div class="clause"><b>5.</b> למען הסר ספק, הקונה/הקונים יחויבו בדמי תיווך כאמור לעיל, גם בהסתמך על מסירת הכתובת הנ''ל ללא צורך בפעולה נוספת מצד המתווך וגם במידה שהסכם הקנייה/תמורות/קומבינציה יבוטל מכל סיבה שהיא לאחר כריתתו.</div>
  <div class="clause"><b>6.</b> דמי התיווך המוסכמים הם כדלהלן: ${esc(f.feePerLot)}</div>
  <div class="clause"><b>7.</b> לכל תשלום שסוכם, יתווסף מע''מ כחוק, לפי שיעור שבתוקף יום התשלום.</div>
  <div class="clause"><b>8.</b> אני/אנו מתחייב/מתחייבים שלא למסור לאיש כל מידע שנמסר לי ע''י המתווך, אלא לשם ביצוע העסקה שבנדון. במידה ואמסור מידע, אשלם את כל התחייבויותיי לעיל.</div>
  <div class="clause"><b>9.</b> סעיפים 4,5,6,7,9 הם מעיקרי ההסכם בין הצדדים והמפר סעיפים אלו יחשב הדבר כהפרה יסודית של ההתקשרות הנ''ל.</div>

  <div class="signature">
    תאריך: <span class="fill">${esc(f.date)}</span>     חתימה וחותמת המזמין: <span class="fill"></span>
  </div>
</body></html>`;
}

// ------------------------- Storage helpers -------------------------
const KEY_LIST = 'contracts:list';

async function loadContracts(): Promise<StoredContract[]> {
  const raw = await AsyncStorage.getItem(KEY_LIST);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredContract[];
  } catch {
    return [];
  }
}

async function saveContracts(list: StoredContract[]) {
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(list));
}

// ------------------------- UI helpers -------------------------
const Button = ({
  title,
  onPress,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={{
      backgroundColor: disabled ? '#a5b4fc' : '#3b82f6',
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      marginVertical: 6,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    }}
  >
    {icon}
    <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>{title}</Text>
  </TouchableOpacity>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View
    style={{
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 14,
      marginVertical: 8,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 1,
    }}
  >
    <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{title}</Text>
    {children}
  </View>
);

const Field = ({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>{label}</Text>
    <TextInput
      style={{ backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12, fontSize: 16 }}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
    />
  </View>
);

// ------------------------- Screens -------------------------
function HeaderBar({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={{ padding: 4, marginEnd: 6 }}>
          <Ionicons name="arrow-undo" size={22} color="#111827" />
        </TouchableOpacity>
      ) : null}
      <Text style={{ fontSize: 22, fontWeight: '800' }}>{title}</Text>
    </View>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [pin, setPin] = useState('');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <HeaderBar title="כניסה" />
        <Card title="קוד PIN">
          <Field label="הכנס PIN" value={pin} onChangeText={setPin} keyboardType="numeric" />
          <Button title="כניסה" onPress={() => (pin === APP_PIN ? onLoggedIn() : Alert.alert('שגיאה', 'PIN שגוי'))} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuScreen({
  onCreate,
  onUseExisting,
  onSendESign,
  onPrintList,
}: {
  onCreate: () => void;
  onUseExisting: () => void;
  onSendESign: () => void;
  onPrintList: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <HeaderBar title="תפריט" />
        <Card title="בחירה">
          <Button title="יצירת חוזה חדש" onPress={onCreate} icon={<Ionicons name="add-circle-outline" size={18} color="#fff" />} />
          <Button
            title="חוזים שמורים / שכפול / מחיקה"
            onPress={onUseExisting}
            icon={<MaterialCommunityIcons name="file-document-edit-outline" size={18} color="#fff" />}
          />
          <Button
            title="שליחה לחתימה דיגיטלית"
            onPress={onSendESign}
            icon={<MaterialCommunityIcons name="signature-freehand" size={18} color="#fff" />}
          />
          <Button
            title="שליחה/שיתוף להדפסה (בחירה מרובה)"
            onPress={onPrintList}
            icon={<Ionicons name="print-outline" size={18} color="#fff" />}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function EditorScreen({
  initial,
  onSave,
  onPreview,
  onBack,
}: {
  initial: ContractFields;
  onSave: (name: string, fields: ContractFields) => void;
  onPreview: (fields: ContractFields) => void;
  onBack: () => void;
}) {
  const [f, setF] = useState<ContractFields>(initial);
  const [name, setName] = useState<string>('חוזה חדש');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <HeaderBar title="עריכת שדות" onBack={onBack} />
        <Card title="פרטי מזמין">
          <Field label="שם ומשפחה" value={f.fullName} onChangeText={(s) => setF({ ...f, fullName: s })} />
          <Field label="ת.ז" value={f.idNumber} onChangeText={(s) => setF({ ...f, idNumber: s })} keyboardType="numeric" />
          <Field label="שם חברה (אם קיים)" value={f.companyName} onChangeText={(s) => setF({ ...f, companyName: s })} />
          <Field label="חתימה/חותמת (טקסט)" value={f.companyStamp} onChangeText={(s) => setF({ ...f, companyStamp: s })} />
        </Card>
        <Card title="פרטי עסקה">
          <Field label="סוג העסקה (טקסט מלא)" value={f.dealType} onChangeText={(s) => setF({ ...f, dealType: s })} />
          <Field label="כתובת" value={f.address} onChangeText={(s) => setF({ ...f, address: s })} />
          <Field label="מחיר עסקה משוער (טקסט מלא)" value={f.approxPrice} onChangeText={(s) => setF({ ...f, approxPrice: s })} />
          <Field label="דמי תיווך — מחרוזת חופשית" value={f.feePerLot} onChangeText={(s) => setF({ ...f, feePerLot: s })} />
          <Field label="תאריך" value={f.date} onChangeText={(s) => setF({ ...f, date: s })} />
        </Card>
        <Card title="שמירה ותצוגה">
          <Field label="שם לעותק (לרשימה)" value={name} onChangeText={setName} />
          <Button title="תצוגה מקדימה / יצירת PDF" onPress={() => onPreview(f)} icon={<Ionicons name="eye-outline" size={18} color="#fff" />} />
          <Button title="שמירת עותק חדש" onPress={() => onSave(name, f)} icon={<Ionicons name="save-outline" size={18} color="#fff" />} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function ListScreen({
  items,
  onDuplicate,
  onDeleteMany,
  onShareMany,
  onBack,
}: {
  items: StoredContract[];
  onDuplicate: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onShareMany: (ids: string[]) => void;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setPicked((p) => ({ ...p, [id]: !p[id] }));
  }

  const selected = Object.keys(picked).filter((k) => picked[k]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <HeaderBar title="חוזים שמורים" onBack={onBack} />
        <Card title={`נבחרו ${selected.length}`}>
          <Button
            title="שיתוף / שליחה"
            onPress={() => onShareMany(selected)}
            disabled={!selected.length}
            icon={<Ionicons name="share-outline" size={18} color="#fff" />}
          />
          <Button
            title="מחיקה"
            onPress={() => onDeleteMany(selected)}
            disabled={!selected.length}
            icon={<Ionicons name="trash-outline" size={18} color="#fff" />}
          />
        </Card>
        {items.length === 0 ? (
          <Text style={{ color: '#6b7280' }}>אין עדיין חוזים.</Text>
        ) : (
          items.map((c) => (
            <Card key={c.id} title={c.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => toggle(c.id)} style={{ padding: 6 }}>
                  <Ionicons name={picked[c.id] ? 'checkbox' : 'square-outline'} size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={{ color: '#6b7280' }}>עודכן: {new Date(c.updatedAt).toLocaleString('he-IL')}</Text>
              </View>
              <Button
                title="שמור עותק חדש (Duplicate)"
                onPress={() => onDuplicate(c.id)}
                icon={<MaterialCommunityIcons name="content-copy" size={18} color="#fff" />}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ESignScreen({
  items,
  onSend,
  onBack,
}: {
  items: StoredContract[];
  onSend: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <HeaderBar title="שליחה לחתימה" onBack={onBack} />
        {items.length === 0 ? (
          <Text style={{ color: '#6b7280' }}>אין חוזים שמורים.</Text>
        ) : (
          items.map((c) => (
            <Card key={c.id} title={c.name}>
              <Button
                title="שלח לחתימה דיגיטלית"
                onPress={() => onSend(c.id)}
                icon={<MaterialCommunityIcons name="signature-freehand" size={18} color="#fff" />}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrintListScreen({
  items,
  onShareMany,
  onBack,
}: {
  items: StoredContract[];
  onShareMany: (ids: string[]) => void;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const selected = Object.keys(picked).filter((k) => picked[k]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <HeaderBar title="שליחה/שיתוף להדפסה" onBack={onBack} />
        <Card title={`נבחרו ${selected.length}`}>
          <Button
            title="שיתוף קבצים שנבחרו"
            onPress={() => onShareMany(selected)}
            disabled={!selected.length}
            icon={<Ionicons name="print-outline" size={18} color="#fff" />}
          />
        </Card>
        {items.length === 0 ? (
          <Text style={{ color: '#6b7280' }}>אין חוזים שמורים.</Text>
        ) : (
          items.map((c) => (
            <Card key={c.id} title={c.name}>
              <TouchableOpacity onPress={() => setPicked((p) => ({ ...p, [c.id]: !p[c.id] }))} style={{ paddingVertical: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={picked[c.id] ? 'checkbox' : 'square-outline'} size={22} color="#111827" />
                  <Text style={{ color: '#6b7280' }}>עודכן: {new Date(c.updatedAt).toLocaleString('he-IL')}</Text>
                </View>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ------------------------- Root -------------------------
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [contracts, setContracts] = useState<StoredContract[]>([]);
  const [editing, setEditing] = useState<StoredContract | null>(null);

  useEffect(() => {
    (async () => setContracts(await loadContracts()))();
  }, []);

  async function saveNew(name: string, fields: ContractFields) {
    const now = Date.now();
    const item: StoredContract = {
      id: Math.random().toString(36).slice(2),
      name,
      fields,
      createdAt: now,
      updatedAt: now,
    };
    const list = [item, ...contracts];
    setContracts(list);
    await saveContracts(list);
    Alert.alert('נשמר', 'העותק נשמר בהצלחה');
    setScreen('menu');
  }

  async function previewPDF(fields: ContractFields) {
    const logo = await loadLogoFileUri();
    const html = renderContractHTML(fields, logo);
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  }

  async function shareMany(ids: string[]) {
    const logo = await loadLogoFileUri();
    for (const id of ids) {
      const it = contracts.find((x) => x.id === id);
      if (!it) continue;
      const html = renderContractHTML(it.fields, logo);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    }
  }

  async function sendForESign(id: string) {
    const it = contracts.find((x) => x.id === id);
    if (!it) return;
    try {
      const logo = await loadLogoFileUri();
      const html = renderContractHTML(it.fields, logo);
      const pdf = await Print.printToFileAsync({ html });
      const b64 = await FileSystem.readAsStringAsync(pdf.uri, { encoding: 'base64' });
      const resp = await fetch(ESIGN_BACKEND + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: it.name + '.pdf',
          file_b64: b64,
          signer_name: it.fields.fullName,
          signer_email: '',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'שגיאה בשליחה');
      Alert.alert('נשלח', 'נוצרה בקשת חתימה. קישור: ' + (data.link || ''));
    } catch (e: any) {
      Alert.alert('שגיאה', e.message || 'נכשל בשליחה');
    }
  }

  async function deleteMany(ids: string[]) {
    if (!ids.length) return;
    const list = contracts.filter((c) => !ids.includes(c.id));
    setContracts(list);
    await saveContracts(list);
  }

  if (!authed) return <LoginScreen onLoggedIn={() => setAuthed(true)} />;

  if (screen === 'menu') {
    return (
      <MenuScreen
        onCreate={() => {
          setEditing({
            id: 'new',
            name: 'חדש',
            fields: DEFAULT_FIELDS,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          setScreen('editor');
        }}
        onUseExisting={() => setScreen('list')}
        onSendESign={() => setScreen('esign')}
        onPrintList={() => setScreen('printList')}
      />
    );
  }

  if (screen === 'editor') {
    return (
      <EditorScreen
        initial={editing?.fields || DEFAULT_FIELDS}
        onSave={saveNew}
        onPreview={previewPDF}
        onBack={() => setScreen('menu')}
      />
    );
  }

  if (screen === 'list') {
    return (
      <ListScreen
        items={contracts}
        onDuplicate={async (id) => {
          const it = contracts.find((x) => x.id === id);
          if (!it) return;
          const now = Date.now();
          const copy: StoredContract = {
            ...it,
            id: Math.random().toString(36).slice(2),
            name: it.name + ' (עותק)',
            createdAt: now,
            updatedAt: now,
          };
          const list = [copy, ...contracts];
          setContracts(list);
          await saveContracts(list);
          Alert.alert('בוצע', 'נשמר עותק חדש');
        }}
        onDeleteMany={deleteMany}
        onShareMany={shareMany}
        onBack={() => setScreen('menu')}
      />
    );
  }

  if (screen === 'esign') {
    return <ESignScreen items={contracts} onSend={sendForESign} onBack={() => setScreen('menu')} />;
  }

  if (screen === 'printList') {
    return <PrintListScreen items={contracts} onShareMany={shareMany} onBack={() => setScreen('menu')} />;
  }

  return null;
}
