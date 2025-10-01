package com.sunat.xadessigner.integration;

import com.sunat.xadessigner.service.XadesSignerService;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import java.io.ByteArrayOutputStream;
import java.io.StringReader;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.Security;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class XadesSignerIntegrationTest {

    @Autowired
    private XadesSignerService xadesSignerService;

    /**
     * Test de integración real que firma un documento UBL válido
     * y verifica que cumple con los requisitos de SUNAT
     */
    @Test
    void shouldSignRealUblDocumentWithXadesBes() throws Exception {
        // Arrange - XML UBL válido con todos los namespaces
        String ublXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
                         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
                         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
                    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
                    <cbc:CustomizationID>2.0</cbc:CustomizationID>
                    <cbc:ID>F001-00000001</cbc:ID>
                    <cbc:IssueDate>2025-09-29</cbc:IssueDate>
                    <cbc:InvoiceTypeCode listID="0101">01</cbc:InvoiceTypeCode>
                    <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
                    <cac:AccountingSupplierParty>
                        <cac:Party>
                            <cac:PartyIdentification>
                                <cbc:ID schemeID="6">20123456789</cbc:ID>
                            </cac:PartyIdentification>
                            <cac:PartyName>
                                <cbc:Name>EMPRESA DE PRUEBA S.A.C.</cbc:Name>
                            </cac:PartyName>
                        </cac:Party>
                    </cac:AccountingSupplierParty>
                    <cac:AccountingCustomerParty>
                        <cac:Party>
                            <cac:PartyIdentification>
                                <cbc:ID schemeID="1">12345678</cbc:ID>
                            </cac:PartyIdentification>
                            <cac:PartyName>
                                <cbc:Name>CLIENTE DE PRUEBA</cbc:Name>
                            </cac:PartyName>
                        </cac:Party>
                    </cac:AccountingCustomerParty>
                    <cac:LegalMonetaryTotal>
                        <cbc:TaxExclusiveAmount currencyID="PEN">100.00</cbc:TaxExclusiveAmount>
                        <cbc:TaxInclusiveAmount currencyID="PEN">118.00</cbc:TaxInclusiveAmount>
                        <cbc:PayableAmount currencyID="PEN">118.00</cbc:PayableAmount>
                    </cac:LegalMonetaryTotal>
                </Invoice>
                """;

        // Certificado P12 efímero generado para el test (auto-firmado)
        String p12Base64 = generateEphemeralP12Certificate();
        String password = "testpass123";

        // Act - Firmar el documento real
        String signedXml = xadesSignerService.signUbl(ublXml, p12Base64, password);

        // Assert - Verificar que el documento fue firmado correctamente
        assertNotNull(signedXml);
        assertTrue(signedXml.length() > ublXml.length());
        
        // Parsear el XML firmado
        Document signedDoc = parseXmlDocument(signedXml);
        
        // Configurar XPath con namespaces
        XPath xpath = createNamespaceAwareXPath();
        
        // Verificar estructura UBL con ext:UBLExtensions
        verifyUblStructure(signedDoc, xpath);
        
        // Verificar firma XMLDSig + XAdES-BES
        verifyXmlSignature(signedDoc, xpath);
        
        // Verificar elementos XAdES-BES específicos
        verifyXadesElements(signedDoc, xpath);
        
        // Verificar algoritmos SUNAT
        verifySignatureAlgorithms(signedDoc, xpath);
    }

    private void verifyUblStructure(Document doc, XPath xpath) throws Exception {
        // Verificar que existe ext:UBLExtensions
        NodeList ublExtensions = (NodeList) xpath.evaluate(
                "//ext:UBLExtensions", doc, XPathConstants.NODESET);
        assertTrue(ublExtensions.getLength() > 0, 
                "Debe existir ext:UBLExtensions en el documento UBL");

        // Verificar que la firma está dentro de UBLExtensions
        NodeList signatureInExtensions = (NodeList) xpath.evaluate(
                "//ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/ds:Signature", 
                doc, XPathConstants.NODESET);
        assertTrue(signatureInExtensions.getLength() > 0, 
                "La firma debe estar dentro de ext:UBLExtensions");
    }

    private void verifyXmlSignature(Document doc, XPath xpath) throws Exception {
        // Verificar que existe la firma principal
        NodeList signatures = (NodeList) xpath.evaluate("//ds:Signature", doc, XPathConstants.NODESET);
        assertEquals(1, signatures.getLength(), "Debe existir exactamente 1 firma XMLDSig");

        // Verificar SignedInfo
        NodeList signedInfo = (NodeList) xpath.evaluate("//ds:SignedInfo", doc, XPathConstants.NODESET);
        assertEquals(1, signedInfo.getLength(), "Debe existir SignedInfo");

        // Verificar que existen exactamente 2 References
        NodeList references = (NodeList) xpath.evaluate("//ds:SignedInfo/ds:Reference", doc, XPathConstants.NODESET);
        assertEquals(2, references.getLength(), 
                "Debe haber exactamente 2 References: documento (URI='') y SignedProperties");

        // Verificar Reference al documento (URI="")
        NodeList docReference = (NodeList) xpath.evaluate(
                "//ds:SignedInfo/ds:Reference[@URI='']", doc, XPathConstants.NODESET);
        assertEquals(1, docReference.getLength(), 
                "Debe existir Reference al documento con URI=''");

        // Verificar transformación enveloped signature
        NodeList envelopedTransform = (NodeList) xpath.evaluate(
                "//ds:SignedInfo/ds:Reference[@URI='']/ds:Transforms/ds:Transform[@Algorithm='http://www.w3.org/2000/09/xmldsig#enveloped-signature']", 
                doc, XPathConstants.NODESET);
        assertEquals(1, envelopedTransform.getLength(), 
                "Debe existir transformación enveloped signature en la referencia al documento");

        // Verificar Reference a SignedProperties (compatible con ambos namespaces XAdES)
        NodeList propsReference = (NodeList) xpath.evaluate(
                "//ds:Reference[@Type='http://uri.etsi.org/01903#SignedProperties' or " +
                "              @Type='http://uri.etsi.org/01903/v1.3.2#SignedProperties']", 
                doc, XPathConstants.NODESET);
        
        assertTrue(propsReference.getLength() >= 1, 
                "Debe existir Reference a SignedProperties (encontradas: " + propsReference.getLength() + ")");
    }

    private void verifyXadesElements(Document doc, XPath xpath) throws Exception {
        // Verificar que existe xades:QualifyingProperties (compatible con ambos namespaces)
        NodeList qualifyingProps = (NodeList) xpath.evaluate(
                "//*[local-name()='QualifyingProperties' and " +
                "(namespace-uri()='http://uri.etsi.org/01903#' or namespace-uri()='http://uri.etsi.org/01903/v1.3.2#')]", 
                doc, XPathConstants.NODESET);
        assertEquals(1, qualifyingProps.getLength(), "Debe existir xades:QualifyingProperties");

        // Verificar que existe xades:SignedProperties (compatible con ambos namespaces)
        NodeList signedProps = (NodeList) xpath.evaluate(
                "//*[local-name()='SignedProperties' and " +
                "(namespace-uri()='http://uri.etsi.org/01903#' or namespace-uri()='http://uri.etsi.org/01903/v1.3.2#')]", 
                doc, XPathConstants.NODESET);
        assertEquals(1, signedProps.getLength(), "Debe existir xades:SignedProperties");

        // Verificar xades:SigningTime (compatible con ambos namespaces)
        NodeList signingTime = (NodeList) xpath.evaluate(
                "//*[local-name()='SigningTime' and " +
                "(namespace-uri()='http://uri.etsi.org/01903#' or namespace-uri()='http://uri.etsi.org/01903/v1.3.2#')]", 
                doc, XPathConstants.NODESET);
        assertEquals(1, signingTime.getLength(), "Debe existir xades:SigningTime");
        
        String signingTimeValue = signingTime.item(0).getTextContent();
        assertNotNull(signingTimeValue, "SigningTime debe tener un valor");
        assertFalse(signingTimeValue.trim().isEmpty(), "SigningTime no debe estar vacío");

        // Verificar xades:SigningCertificate (compatible con ambos namespaces)
        NodeList signingCert = (NodeList) xpath.evaluate(
                "//*[local-name()='SigningCertificate' and " +
                "(namespace-uri()='http://uri.etsi.org/01903#' or namespace-uri()='http://uri.etsi.org/01903/v1.3.2#')]", 
                doc, XPathConstants.NODESET);
        assertEquals(1, signingCert.getLength(), "Debe existir xades:SigningCertificate");

        // Verificar KeyInfo/X509Certificate
        NodeList x509Cert = (NodeList) xpath.evaluate("//ds:KeyInfo/ds:X509Data/ds:X509Certificate", doc, XPathConstants.NODESET);
        assertEquals(1, x509Cert.getLength(), "Debe existir ds:KeyInfo/ds:X509Data/ds:X509Certificate");
        
        String certValue = x509Cert.item(0).getTextContent();
        assertNotNull(certValue, "X509Certificate debe tener un valor");
        assertFalse(certValue.trim().isEmpty(), "X509Certificate no debe estar vacío");
    }

    private void verifySignatureAlgorithms(Document doc, XPath xpath) throws Exception {
        // Verificar algoritmo de firma (RSA-SHA256)
        NodeList signatureMethod = (NodeList) xpath.evaluate(
                "//ds:SignedInfo/ds:SignatureMethod[@Algorithm='http://www.w3.org/2001/04/xmldsig-more#rsa-sha256']", 
                doc, XPathConstants.NODESET);
        assertEquals(1, signatureMethod.getLength(), 
                "Debe usar algoritmo de firma RSA-SHA256");

        // Verificar algoritmo de digest (SHA-256)
        NodeList digestMethod = (NodeList) xpath.evaluate(
                "//ds:SignedInfo/ds:Reference/ds:DigestMethod[@Algorithm='http://www.w3.org/2001/04/xmlenc#sha256']", 
                doc, XPathConstants.NODESET);
        assertTrue(digestMethod.getLength() >= 1, 
                "Debe usar algoritmo de digest SHA-256");

        // Verificar canonicalización (C14N)
        NodeList canonicalization = (NodeList) xpath.evaluate(
                "//ds:SignedInfo/ds:CanonicalizationMethod[@Algorithm='http://www.w3.org/TR/2001/REC-xml-c14n-20010315']", 
                doc, XPathConstants.NODESET);
        assertEquals(1, canonicalization.getLength(), 
                "Debe usar canonicalización C14N 20010315");
    }

    private Document parseXmlDocument(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new InputSource(new StringReader(xml)));
    }

    private XPath createNamespaceAwareXPath() {
        XPath xpath = XPathFactory.newInstance().newXPath();
        xpath.setNamespaceContext(new javax.xml.namespace.NamespaceContext() {
            @Override
            public String getNamespaceURI(String prefix) {
                return switch (prefix) {
                    case "ds" -> "http://www.w3.org/2000/09/xmldsig#";
                    case "xades" -> "http://uri.etsi.org/01903/v1.3.2#";
                    case "ext" -> "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";
                    case "cac" -> "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
                    case "cbc" -> "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
                    default -> null;
                };
            }

            @Override
            public String getPrefix(String namespaceURI) {
                return null;
            }

            @Override
            public java.util.Iterator<String> getPrefixes(String namespaceURI) {
                return null;
            }
        });
        return xpath;
    }

    /**
     * Genera un certificado P12 efímero para testing (auto-firmado)
     * No se guardan secretos en el repo - todo se genera en memoria
     */
    private String generateEphemeralP12Certificate() {
        try {
            // Generar par de claves RSA
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
            keyGen.initialize(2048);
            KeyPair keyPair = keyGen.generateKeyPair();

            // Crear certificado auto-firmado
            X500Name issuer = new X500Name("CN=Test Certificate for XAdES, OU=Testing, O=Test Company, L=Lima, ST=Lima, C=PE");
            BigInteger serial = BigInteger.valueOf(System.currentTimeMillis());
            Date notBefore = new Date();
            Date notAfter = new Date(System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000); // 1 año

            JcaX509v3CertificateBuilder certBuilder = new JcaX509v3CertificateBuilder(
                    issuer, serial, notBefore, notAfter, issuer, keyPair.getPublic());

            ContentSigner signer = new JcaContentSignerBuilder("SHA256withRSA")
                    .setProvider(new BouncyCastleProvider())
                    .build(keyPair.getPrivate());

            X509Certificate cert = new JcaX509CertificateConverter()
                    .setProvider(new BouncyCastleProvider())
                    .getCertificate(certBuilder.build(signer));

            // Crear KeyStore PKCS12 en memoria
            KeyStore keyStore = KeyStore.getInstance("PKCS12");
            keyStore.load(null, null);
            keyStore.setKeyEntry("testcert", keyPair.getPrivate(), "testpass123".toCharArray(), 
                    new X509Certificate[]{cert});

            // Convertir a Base64
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            keyStore.store(baos, "testpass123".toCharArray());
            return Base64.getEncoder().encodeToString(baos.toByteArray());

        } catch (Exception e) {
            throw new RuntimeException("Error generando certificado efímero para test", e);
        }
    }

    @BeforeAll
    static void setupBouncyCastle() {
        Security.addProvider(new BouncyCastleProvider());
    }
}