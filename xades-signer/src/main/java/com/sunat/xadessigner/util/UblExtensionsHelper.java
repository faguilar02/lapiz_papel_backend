package com.sunat.xadessigner.util;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/**
 * Utilidad para manejar los elementos UBLExtensions en documentos UBL
 */
public class UblExtensionsHelper {
    
    private static final String UBL_EXTENSIONS_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";
    private static final String UBL_EXTENSIONS_TAG = "UBLExtensions";
    private static final String UBL_EXTENSION_TAG = "UBLExtension";
    private static final String EXTENSION_CONTENT_TAG = "ExtensionContent";
    
    /**
     * Asegura que existan los elementos UBLExtensions/UBLExtension/ExtensionContent
     * en el documento UBL y retorna el elemento ExtensionContent donde insertar la firma
     * 
     * @param document Documento UBL
     * @return Elemento ExtensionContent donde insertar la firma
     */
    public static Element ensureUblExtensions(Document document) {
        Element rootElement = document.getDocumentElement();
        
        // Buscar si ya existe UBLExtensions
        Element ublExtensions = findOrCreateUblExtensions(document, rootElement);
        
        // Buscar si ya existe UBLExtension para firma
        Element ublExtension = findOrCreateUblExtension(document, ublExtensions);
        
        // Buscar si ya existe ExtensionContent
        Element extensionContent = findOrCreateExtensionContent(document, ublExtension);
        
        return extensionContent;
    }
    
    private static Element findOrCreateUblExtensions(Document document, Element rootElement) {
        // Buscar UBLExtensions existente
        NodeList ublExtensionsList = rootElement.getElementsByTagNameNS(UBL_EXTENSIONS_NS, UBL_EXTENSIONS_TAG);
        
        if (ublExtensionsList.getLength() > 0) {
            return (Element) ublExtensionsList.item(0);
        }
        
        // Crear UBLExtensions
        Element ublExtensions = document.createElementNS(UBL_EXTENSIONS_NS, "ext:" + UBL_EXTENSIONS_TAG);
        ublExtensions.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:ext", UBL_EXTENSIONS_NS);
        
        // Insertar como primer hijo del elemento raíz
        Node firstChild = rootElement.getFirstChild();
        if (firstChild != null) {
            rootElement.insertBefore(ublExtensions, firstChild);
        } else {
            rootElement.appendChild(ublExtensions);
        }
        
        return ublExtensions;
    }
    
    private static Element findOrCreateUblExtension(Document document, Element ublExtensions) {
        // Buscar UBLExtension existente para firma
        NodeList ublExtensionList = ublExtensions.getElementsByTagNameNS(UBL_EXTENSIONS_NS, UBL_EXTENSION_TAG);
        
        // Buscar una extensión que pueda contener la firma o usar la primera disponible
        for (int i = 0; i < ublExtensionList.getLength(); i++) {
            Element extension = (Element) ublExtensionList.item(i);
            NodeList contentList = extension.getElementsByTagNameNS(UBL_EXTENSIONS_NS, EXTENSION_CONTENT_TAG);
            if (contentList.getLength() > 0) {
                Element content = (Element) contentList.item(0);
                // Si el contenido está vacío o solo tiene texto/espacios, lo usamos
                if (isEmptyOrWhitespace(content)) {
                    return extension;
                }
            }
        }
        
        // Crear nuevo UBLExtension
        Element ublExtension = document.createElementNS(UBL_EXTENSIONS_NS, "ext:" + UBL_EXTENSION_TAG);
        ublExtensions.appendChild(ublExtension);
        
        return ublExtension;
    }
    
    private static Element findOrCreateExtensionContent(Document document, Element ublExtension) {
        // Buscar ExtensionContent existente
        NodeList contentList = ublExtension.getElementsByTagNameNS(UBL_EXTENSIONS_NS, EXTENSION_CONTENT_TAG);
        
        if (contentList.getLength() > 0) {
            Element content = (Element) contentList.item(0);
            // Si el contenido está vacío o solo tiene texto/espacios, lo limpiamos y usamos
            if (isEmptyOrWhitespace(content)) {
                // Limpiar contenido existente
                while (content.hasChildNodes()) {
                    content.removeChild(content.getFirstChild());
                }
                return content;
            }
        }
        
        // Crear ExtensionContent
        Element extensionContent = document.createElementNS(UBL_EXTENSIONS_NS, "ext:" + EXTENSION_CONTENT_TAG);
        ublExtension.appendChild(extensionContent);
        
        return extensionContent;
    }
    
    private static boolean isEmptyOrWhitespace(Element element) {
        if (!element.hasChildNodes()) {
            return true;
        }
        
        NodeList children = element.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() == Node.ELEMENT_NODE) {
                return false; // Tiene elementos hijos
            }
            if (child.getNodeType() == Node.TEXT_NODE && 
                child.getTextContent() != null && 
                !child.getTextContent().trim().isEmpty()) {
                return false; // Tiene texto no vacío
            }
        }
        
        return true; // Solo texto vacío o espacios
    }
}