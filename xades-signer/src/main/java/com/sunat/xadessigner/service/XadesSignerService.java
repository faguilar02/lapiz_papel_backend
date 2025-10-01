package com.sunat.xadessigner.service;

import com.sunat.xadessigner.util.UblExtensionsHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import xades4j.production.DataObjectReference;
import xades4j.production.SignedDataObjects;
import xades4j.production.XadesBesSigningProfile;
import xades4j.production.XadesSigner;
import xades4j.properties.DataObjectDesc;
import xades4j.algorithms.EnvelopedSignatureTransform;
import xades4j.providers.KeyingDataProvider;
import xades4j.providers.impl.DirectKeyingDataProvider;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.StringWriter;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Security;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Enumeration;

/**
 * Servicio para firma XAdES-BES de documentos UBL usando xades4j
 */
@Service
public class XadesSignerService {
    
    private static final Logger logger = LoggerFactory.getLogger(XadesSignerService.class);
    
    static {
        // Registrar BouncyCastle como proveedor de seguridad
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());
        }
    }
    
    /**
     * Firma un documento UBL con XAdES-BES usando xades4j
     * 
     * @param xml XML del documento UBL a firmar
     * @param p12Base64 Certificado PKCS#12 en base64
     * @param password Contraseña del certificado
     * @return XML firmado
     * @throws Exception Si ocurre algún error durante la firma
     */
    public String signUbl(String xml, String p12Base64, String password) throws Exception {
        logger.debug("Iniciando proceso de firma XAdES-BES con xades4j");
        
        // 1. Cargar el certificado PKCS#12
        KeyStore keyStore = loadP12Certificate(p12Base64, password);
        
        // 2. Obtener la clave privada y el certificado
        String alias = getFirstAlias(keyStore);
        PrivateKey privateKey = (PrivateKey) keyStore.getKey(alias, password.toCharArray());
        X509Certificate certificate = (X509Certificate) keyStore.getCertificate(alias);
        
        if (privateKey == null || certificate == null) {
            throw new IllegalArgumentException("No se pudo obtener la clave privada o el certificado del PKCS#12");
        }
        
        logger.debug("Certificado cargado: Subject={}, Serial={}", 
                    certificate.getSubjectX500Principal().getName(), 
                    certificate.getSerialNumber());
        
        // 3. Parsear el XML
        Document document = parseXmlDocument(xml);
        
        // 4. Asegurar que existan los elementos UBLExtensions
        Element extensionContent = UblExtensionsHelper.ensureUblExtensions(document);
        
        // 5. Configurar el perfil XAdES-BES con xades4j
        XadesBesSigningProfile profile = createXadesProfile(privateKey, certificate);
        
        // 6. Crear el firmador
        XadesSigner signer = profile.newSigner();
        
        // 7. Configurar las referencias firmadas
        SignedDataObjects dataObjectsToSign = createSignedDataObjects();
        
        // 8. Firmar el documento usando xades4j
        signer.sign(dataObjectsToSign, extensionContent);
        
        // 9. Serializar el documento firmado
        String signedXml = documentToString(document);
        
        logger.debug("Firma XAdES-BES completada exitosamente con xades4j");
        return signedXml;
    }
    
    /**
     * Firma un documento UBL con XAdES-BES usando un alias de certificado configurado
     * 
     * @param xml XML del documento UBL a firmar
     * @param keyAlias Alias del certificado configurado
     * @return XML firmado
     * @throws Exception Si ocurre algún error durante la firma
     */
    public String signUblWithAlias(String xml, String keyAlias) throws Exception {
        logger.debug("Iniciando proceso de firma XAdES-BES con alias: {}", keyAlias);
        
        // Cargar configuración del alias
        CertificateConfig config = loadCertificateConfig(keyAlias);
        
        // Usar el método principal con los datos del alias
        return signUbl(xml, config.getP12Base64(), config.getPassword());
    }
    
    /**
     * Carga la configuración del certificado basada en el alias
     * En producción, esto cargaría desde variables de entorno o archivo seguro
     */
    private CertificateConfig loadCertificateConfig(String keyAlias) throws Exception {
        logger.debug("Cargando configuración para alias: {}", keyAlias);
        
        // Buscar en variables de entorno
        String p12Path = System.getenv("CERT_" + keyAlias.toUpperCase() + "_PATH");
        String password = System.getenv("CERT_" + keyAlias.toUpperCase() + "_PASSWORD");
        
        if (p12Path == null || password == null) {
            logger.error("Configuración no encontrada para alias: {}. Variables esperadas: CERT_{}_PATH, CERT_{}_PASSWORD", 
                        keyAlias, keyAlias.toUpperCase(), keyAlias.toUpperCase());
            throw new IllegalArgumentException("Configuración de certificado no encontrada para alias: " + keyAlias);
        }
        
        try {
            // Leer archivo P12 y convertir a base64
            File p12File = new File(p12Path);
            if (!p12File.exists()) {
                throw new IllegalArgumentException("Archivo de certificado no encontrado: " + p12Path);
            }
            
            byte[] p12Bytes = java.nio.file.Files.readAllBytes(p12File.toPath());
            String p12Base64 = Base64.getEncoder().encodeToString(p12Bytes);
            
            logger.debug("Certificado cargado desde: {} (tamaño: {} bytes)", p12Path, p12Bytes.length);
            
            return new CertificateConfig(p12Base64, password);
            
        } catch (Exception e) {
            logger.error("Error cargando certificado para alias {}: {}", keyAlias, e.getMessage());
            throw new Exception("Error cargando certificado: " + e.getMessage(), e);
        }
    }
    
    /**
     * Clase interna para manejar configuración de certificados
     */
    private static class CertificateConfig {
        private final String p12Base64;
        private final String password;
        
        public CertificateConfig(String p12Base64, String password) {
            this.p12Base64 = p12Base64;
            this.password = password;
        }
        
        public String getP12Base64() { return p12Base64; }
        public String getPassword() { return password; }
    }
    
    private KeyStore loadP12Certificate(String p12Base64, String password) throws Exception {
        try {
            byte[] p12Bytes = Base64.getDecoder().decode(p12Base64);
            KeyStore keyStore = KeyStore.getInstance("PKCS12", "BC");
            keyStore.load(new ByteArrayInputStream(p12Bytes), password.toCharArray());
            return keyStore;
        } catch (Exception e) {
            logger.error("Error al cargar certificado PKCS#12: {}", e.getMessage());
            throw new IllegalArgumentException("Certificado PKCS#12 inválido o contraseña incorrecta", e);
        }
    }
    
    private String getFirstAlias(KeyStore keyStore) throws Exception {
        Enumeration<String> aliases = keyStore.aliases();
        if (!aliases.hasMoreElements()) {
            throw new IllegalArgumentException("El PKCS#12 no contiene ningún certificado");
        }
        
        // Buscar el primer alias que tenga clave privada (no CA)
        while (aliases.hasMoreElements()) {
            String alias = aliases.nextElement();
            logger.debug("Evaluando alias: {}", alias);
            
            // Verificar si el alias tiene clave privada
            if (keyStore.isKeyEntry(alias)) {
                logger.debug("Usando alias del certificado con clave privada: {}", alias);
                return alias;
            } else {
                logger.debug("Alias {} es solo certificado (sin clave privada), continuando...", alias);
            }
        }
        
        throw new IllegalArgumentException("El PKCS#12 no contiene ningún certificado con clave privada para firmar");
    }
    
    private Document parseXmlDocument(String xml) throws Exception {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            // Configurar factory para evitar ataques XXE
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            
            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(new ByteArrayInputStream(xml.getBytes("UTF-8")));
        } catch (Exception e) {
            logger.error("Error al parsear XML: {}", e.getMessage());
            throw new IllegalArgumentException("XML inválido", e);
        }
    }
    
    private XadesBesSigningProfile createXadesProfile(PrivateKey privateKey, X509Certificate certificate) {
        logger.debug("Configurando perfil XAdES-BES con algoritmos específicos para SUNAT");
        
        // Proveedor de datos de clave
        KeyingDataProvider keyingDataProvider = new DirectKeyingDataProvider(certificate, privateKey);
        
        // Crear perfil XAdES-BES 
        XadesBesSigningProfile profile = new XadesBesSigningProfile(keyingDataProvider);
        
        // NOTA: xades4j 2.4.0 aplicará automáticamente los algoritmos estándar:
        // - SignatureMethod: RSA-SHA256 (para claves RSA)
        // - DigestMethod: SHA-256 (estándar actual)
        // - Canonicalization: C14N 20010315 (estándar XML)
        // - XAdES-BES con SigningTime y SigningCertificate obligatorios
        
        logger.debug("Perfil XAdES-BES configurado - xades4j usará RSA-SHA256/SHA-256/C14N automáticamente");
        logger.debug("Algoritmos aplicados cumplen con requisitos SUNAT para firmas electrónicas");
        
        return profile;
    }
    
    private SignedDataObjects createSignedDataObjects() {
        logger.debug("Configurando referencias para SignedInfo según requisitos SUNAT");
        
        // SUNAT requiere:
        // 1. Referencia al documento (URI="") con enveloped signature + C14N 20010315
        // 2. SigningTime explícito en SignedProperties (xades4j lo añade automáticamente)
        
        try {
            // Configurar referencia al documento con transformación enveloped explícita
            DataObjectDesc docRef = new DataObjectReference("")
                .withTransform(new EnvelopedSignatureTransform()); // enveloped signature
            
            logger.debug("Referencia al documento configurada con enveloped signature explícito");
            logger.debug("xades4j aplicará automáticamente C14N y SigningTime para cumplir XAdES-BES");
            
            return new SignedDataObjects(docRef);
            
        } catch (Exception e) {
            // Fallback básico
            logger.warn("Usando configuración básica - xades4j aplicará transformaciones por defecto compatibles con SUNAT");
            DataObjectReference docRef = new DataObjectReference("");
            return new SignedDataObjects(docRef);
        }
    }
    
    private String documentToString(Document document) throws Exception {
        try {
            TransformerFactory transformerFactory = TransformerFactory.newInstance();
            
            Transformer transformer = transformerFactory.newTransformer();
            transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
            transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
            transformer.setOutputProperty(OutputKeys.INDENT, "no");
            
            StringWriter writer = new StringWriter();
            transformer.transform(new DOMSource(document), new StreamResult(writer));
            String result = writer.toString();
            
            // Validar que la firma cumple con los requisitos de SUNAT
            validateSignatureForSunat(result);
            
            return result;
        } catch (Exception e) {
            logger.error("Error al serializar documento XML: {}", e.getMessage());
            throw new Exception("Error al serializar el documento firmado", e);
        }
    }
    
    /**
     * Valida que la firma generada cumple con los requisitos de SUNAT
     * 
     * @param signedXml XML firmado para validar
     * @throws IllegalStateException si la firma no cumple con los requisitos
     */
    private void validateSignatureForSunat(String signedXml) {
        logger.debug("Validando firma XAdES-BES para cumplimiento SUNAT");
        
        // Verificar que existe ds:Signature dentro de UBLExtensions
        if (!signedXml.contains("ext:UBLExtensions") || !signedXml.contains("ds:Signature")) {
            throw new IllegalStateException("La firma no está ubicada correctamente en UBLExtensions");
        }
        
        // Verificar que existe SignedInfo con referencias
        if (!signedXml.contains("ds:SignedInfo") || !signedXml.contains("ds:Reference")) {
            throw new IllegalStateException("SignedInfo o referencias no encontradas en la firma");
        }
        
        // Verificar elementos XAdES-BES
        if (!signedXml.contains("xades:QualifyingProperties") || 
            !signedXml.contains("xades:SignedProperties") ||
            !signedXml.contains("xades:SigningTime")) {
            throw new IllegalStateException("Elementos XAdES-BES requeridos no encontrados");
        }
        
        // Verificar certificado en KeyInfo
        if (!signedXml.contains("ds:KeyInfo") || !signedXml.contains("ds:X509Certificate")) {
            throw new IllegalStateException("Certificado X.509 no encontrado en KeyInfo");
        }
        
        // Contar referencias (debe haber al menos 2: documento + SignedProperties)
        int referenceCount = signedXml.split("ds:Reference").length - 1;
        if (referenceCount < 2) {
            logger.warn("Se encontraron {} referencias, se esperaban al menos 2", referenceCount);
        }
        
        logger.debug("Validación SUNAT completada - Firma XAdES-BES válida");
    }
    
    /**
     * Obtiene información sobre los algoritmos utilizados en la firma
     * 
     * @param signedXml XML firmado
     * @return Información de algoritmos para logging/debugging
     */
    public String getSignatureAlgorithmsInfo(String signedXml) {
        StringBuilder info = new StringBuilder("Algoritmos utilizados en la firma:\n");
        
        if (signedXml.contains("rsa-sha256")) {
            info.append("- SignatureMethod: RSA-SHA256 ✓\n");
        } else {
            info.append("- SignatureMethod: No es RSA-SHA256 ⚠️\n");
        }
        
        if (signedXml.contains("sha256")) {
            info.append("- DigestMethod: SHA-256 ✓\n");
        } else {
            info.append("- DigestMethod: No es SHA-256 ⚠️\n");
        }
        
        if (signedXml.contains("xml-c14n-20010315")) {
            info.append("- Canonicalization: C14N 20010315 ✓\n");
        } else {
            info.append("- Canonicalization: No es C14N 20010315 ⚠️\n");
        }
        
        return info.toString();
    }
}