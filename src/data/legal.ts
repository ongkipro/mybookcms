type LegalPageKey = 'privacy' | 'shipping' | 'tos' | 'disclaimer' | 'contact';
type LegalPageTemplate = {
  badge: string;
  title: string;
  description: string;
  sections: Array<{ id?: string; lang?: "ms" | "en"; title: string; paragraphs: string[] }>;
};

export const legalPages: Record<LegalPageKey, LegalPageTemplate> = {
  privacy: {
    badge: 'Dasar Privasi',
    title: 'Dasar Privasi {{store}}',
    description: 'Penjelasan tentang data yang boleh diproses apabila anda melawat kedai atau membuat pesanan di {{store}}.',
    sections: [
      {
        lang: "ms",
        title: 'Data pesanan',
        paragraphs: [
          'Apabila anda membuat pesanan, sistem boleh memproses nama, nombor telefon atau WhatsApp, alamat penghantaran, item pesanan dan kaedah bayaran yang anda berikan.',
          'Data ini digunakan untuk merekod pesanan, menghubungi anda tentang pesanan dan menjalankan pembayaran atau penghantaran yang tersedia.',
        ],
      },
      {
        lang: "ms",
        title: 'Data teknikal',
        paragraphs: [
          'Sistem boleh memproses maklumat teknikal yang diperlukan untuk keselamatan dan operasi checkout, seperti alamat IP serta maklumat pelayar.',
        ],
      },
      {
        lang: "ms",
        title: 'Pengukuran dan pengiklanan',
        paragraphs: [
          'Apabila integrasi pengiklanan dikonfigurasikan untuk kedai ini, tag dan pengenal Meta dan/atau Google boleh dimuatkan pada storefront untuk mengukur keberkesanan iklan serta mengaitkan lawatan dengan hasil iklan.',
          'Bagi pesanan yang diterima, maklumat peristiwa pembelian boleh dihantar terus dari pelayan kedai kepada platform pengiklanan tersebut. Nama, nombor telefon, bandar, negeri dan poskod yang digunakan untuk padanan dihantar dalam bentuk cincangan sehala (SHA-256), bukan sebagai teks biasa. Alamat IP dan maklumat pelayar dihantar sebagaimana adanya kerana platform tersebut memerlukannya untuk padanan.',
          'Butiran storan dan pengenal yang terlibat diterangkan dalam Dasar Kuki kedai ini.',
        ],
      },
      {
        lang: "ms",
        title: 'Penyedia perkhidmatan',
        paragraphs: [
          'Data yang diperlukan boleh diberikan kepada pihak penghantaran, customer service atau bank penerima hanya untuk menjalankan pesanan anda.',
          'Setiap penyedia memproses data mengikut terma dan dasar privasinya sendiri.',
        ],
      },
      {
        lang: "ms",
        id: 'pembayaran-doku',
        title: 'Pembayaran melalui DOKU',
        paragraphs: [
          'Jika anda memilih pembayaran DOKU, {{store}} menghantar nama, nombor telefon, alamat e-mel, alamat penghantaran, butiran pesanan, jumlah dalam MYR serta maklumat teknikal yang diperlukan untuk menyediakan pembayaran, mencegah penyalahgunaan dan menyemak status transaksi.',
          'Pembayaran diselesaikan pada halaman hos DOKU. DOKU memproses data tersebut mengikut dasar privasi dan terma perkhidmatannya sendiri. {{store}} tidak mengumpul atau menyimpan nombor kad, CVV atau kelayakan perbankan anda. Status bayaran hanya dikemas kini selepas pengesahan pelayan diterima.',
        ],
      },
      {
        lang: "ms",
        title: 'Keselamatan dan penyimpanan',
        paragraphs: [
          'Pengelola kedai menghadkan akses pentadbiran dan menggunakan langkah keselamatan teknikal yang tersedia. Tiada kaedah penyimpanan atau penghantaran data bebas risiko sepenuhnya.',
          'Tempoh penyimpanan data bergantung pada keperluan operasi, penyelesaian pertikaian dan kewajipan undang-undang yang berkenaan.',
        ],
      },
      {
        lang: "ms",
        title: 'Permintaan berkaitan data',
        paragraphs: [
          'Permintaan akses, pembetulan atau pemadaman data boleh dibuat melalui customer service kedai. Permintaan mungkin memerlukan pengesahan identiti dan masih tertakluk pada kewajipan penyimpanan yang berkenaan.',
        ],
      },
      {
        lang: "en",
        title: 'Privacy Notice — {{store}}',
        paragraphs: [
          "An explanation of the data that may be processed when you visit or place an order with {{store}}.",
        ],
      },
      {
        lang: "en",
        title: 'Order data',
        paragraphs: [
          "When you place an order, the system may process the name, phone or WhatsApp number, delivery address, ordered items and payment method you provide.",
          "This data is used to record your order, contact you about it, and carry out the available payment or delivery process.",
        ],
      },
      {
        lang: "en",
        title: 'Technical data',
        paragraphs: [
          "The system may process technical information needed for security and checkout operations, such as your IP address and browser information.",
        ],
      },
      {
        lang: "en",
        title: 'Measurement and advertising',
        paragraphs: [
          "When advertising integrations are configured for this store, Meta and/or Google tags and identifiers may load on the storefront to measure advertising effectiveness and attribute visits to advertising results.",
          "For accepted orders, purchase-event information may be sent directly from the store server to those advertising platforms. Names, phone numbers, cities, states and postcodes used for matching are sent as one-way SHA-256 hashes rather than plain text. IP addresses and browser information are sent without hashing because the platforms require them for matching.",
          "The store’s Cookie Policy describes the storage and identifiers involved.",
        ],
      },
      {
        lang: "en",
        title: 'Service providers',
        paragraphs: [
          "Necessary data may be shared with delivery providers, customer service or the receiving bank solely to fulfil your order.",
          "Each provider processes data under its own terms and privacy policy.",
        ],
      },
      {
        lang: "en",
        title: 'Payments through DOKU',
        paragraphs: [
          'If you choose DOKU payment, {{store}} sends your name, phone number, email address, delivery address, order details, MYR amount, and technical information required to prepare the payment, prevent misuse, and check transaction status.',
          'Payment is completed on DOKU’s hosted page. DOKU processes this data under its own privacy policy and service terms. {{store}} does not collect or store your card number, CVV, or online-banking credentials. Payment status is updated only after server confirmation is received.',
        ],
      },
      {
        lang: "en",
        title: 'Security and retention',
        paragraphs: [
          "The store operator restricts administrative access and uses the available technical security measures. No method of storing or transmitting data is entirely risk-free.",
          "Data retention depends on operational needs, dispute resolution and applicable legal obligations.",
        ],
      },
      {
        lang: "en",
        title: 'Data requests',
        paragraphs: [
          "You can request access to, correction of or deletion of your data through the store’s customer service. Requests may require identity verification and remain subject to applicable retention obligations.",
        ],
      },
    ],
  },
  shipping: {
    badge: 'Penghantaran & Pemulangan',
    title: 'Maklumat Penghantaran & Pemulangan {{store}}',
    description: 'Maklumat umum tentang penghantaran domestik Malaysia, COD dan pemulangan di {{store}}.',
    sections: [
      {
        title: 'Ketersediaan penghantaran',
        paragraphs: [
          'Kadar dan ketersediaan penghantaran bergantung pada poskod destinasi dan berat pesanan semasa checkout.',
          'Pesanan diproses selepas maklumat pesanan disahkan. Kemas kini penghantaran dihantar terus melalui WhatsApp.',
        ],
      },
      {
        title: 'Anggaran dan penjejakan',
        paragraphs: [
          'Anggaran masa tiba bukan jaminan tarikh penerimaan. Cuaca, cuti umum, kapasiti kurier dan keadaan kawasan boleh menjejaskan tempoh penghantaran.',
          'Hubungi kedai melalui WhatsApp jika anda memerlukan kemas kini penghantaran lanjut.',
        ],
      },
      {
        title: 'Cash on Delivery (COD)',
        paragraphs: [
          'COD tersedia mengikut kaedah bayaran dan kadar penghantaran yang sah semasa pesanan dibuat.',
        ],
      },
      {
        title: 'Permohonan pemulangan',
        paragraphs: [
          'Hubungi customer service sebelum menghantar barang kembali. Sertakan nombor pesanan, alasan dan bukti keadaan barang untuk semakan.',
          'Kelulusan, alamat pemulangan, kos dan tempoh permohonan akan disahkan berdasarkan keadaan pesanan serta dasar kedai.',
        ],
      },
    ],
  },
  tos: {
    badge: 'Terma & Syarat',
    title: 'Terma & Syarat {{store}}',
    description: 'Terma penggunaan storefront, maklumat pesanan, harga dan ketersediaan di {{store}}.',
    sections: [
      {
        title: 'Penggunaan storefront',
        paragraphs: [
          'Dengan menggunakan storefront dan membuat pesanan, anda mengesahkan bahawa data yang diberikan tepat dan boleh digunakan untuk memproses pesanan.',
          'Anda tidak boleh membuat pesanan palsu, menyalahgunakan borang atau menggunakan storefront bagi aktiviti yang menyalahi undang-undang.',
        ],
      },
      {
        title: 'Produk, harga dan ketersediaan',
        paragraphs: [
          'Harga dipaparkan dalam Ringgit Malaysia (MYR). Pilihan produk, harga dan ketersediaan boleh berubah sebelum pesanan disahkan.',
          'Jika produk atau perkhidmatan tidak tersedia, pengelola kedai boleh menghubungi anda tentang perubahan atau pembatalan pesanan sebelum penghantaran.',
        ],
      },
      {
        title: 'Perubahan dan pembatalan pesanan',
        paragraphs: [
          'Permintaan perubahan atau pembatalan perlu dibuat melalui customer service. Kemungkinan perubahan bergantung pada status pemprosesan, bayaran dan penyerahan bungkusan.',
        ],
      },
      {
        title: 'Undang-undang yang terpakai',
        paragraphs: [
          'Terma ini ditafsirkan menurut undang-undang yang terpakai di Malaysia. Terma khusus yang diberi semasa transaksi turut terpakai bersama halaman ini.',
        ],
      },
    ],
  },
  disclaimer: {
    badge: 'Disclaimer',
    title: 'Disclaimer {{store}}',
    description: 'Batas penggunaan maklumat produk, harga, ketersediaan dan anggaran yang dipaparkan pada storefront.',
    sections: [
      {
        title: 'Maklumat storefront',
        paragraphs: [
          'Maklumat produk datang daripada katalog yang diterbitkan oleh pengelola kedai. Semak pilihan, harga, ketersediaan dan butiran pesanan sebelum menghantar borang.',
          'Ketersediaan produk, kadar penghantaran dan anggaran boleh berubah mengikut keadaan transaksi.',
        ],
      },
    ],
  },
  contact: {
    badge: 'Hubungi Kami',
    title: 'Hubungi {{store}}',
    description: 'Maklumat customer service yang diterbitkan oleh pengelola {{store}}.',
    sections: [
      {
        title: 'Customer service',
        paragraphs: [
          'Gunakan maklumat berikut untuk pertanyaan produk, pesanan, penghantaran, bayaran atau pemulangan.',
          'WhatsApp CS: {{whatsapp}}',
        ],
      },
    ],
  },
};

export interface LegalPageContext {
  storeName?: string;
  supportWhatsapp?: string;
}

/**
 * Legal copy is shipped as a template so a fresh install renders its own
 * identity instead of the name it was cloned from. Any paragraph whose
 * placeholder cannot be resolved is dropped rather than shown half-filled.
 */
export function getTenantLegalPage(
  key: keyof typeof legalPages,
  storeName?: string,
  context: LegalPageContext = {},
) {
  const page = legalPages[key];
  const store = storeName || context.storeName || 'Kedai Kami';
  const whatsapp = context.supportWhatsapp?.trim() || '';
  const fill = (value: string) =>
    value.replaceAll('{{store}}', store).replaceAll('{{whatsapp}}', whatsapp);

  if (key === 'contact' && !whatsapp) {
    return {
      ...page,
      title: fill(page.title),
      description: 'Pengelola kedai belum menerbitkan maklumat customer service.',
      sections: [
        {
          title: 'Maklumat hubungan belum tersedia',
          paragraphs: [
            'Nombor WhatsApp customer service belum dikonfigurasikan oleh pengelola kedai.',
          ],
        },
      ],
    };
  }

  return {
    ...page,
    title: fill(page.title),
    description: fill(page.description),
    sections: page.sections
      .map((section) => ({
        ...section,
        title: fill(section.title),
        paragraphs: section.paragraphs
          .filter((paragraph) => whatsapp || !paragraph.includes('{{whatsapp}}'))
          .map(fill),
      }))
      .filter((section) => section.paragraphs.length > 0),
  };
}
