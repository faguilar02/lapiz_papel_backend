package com.sunat.xadessigner.controller;

import com.sunat.xadessigner.service.XadesSignerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SignController.class)
class SignControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private XadesSignerService xadesSignerService;

    @Test
    void healthEndpointShouldReturnOk() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(content().string("OK"));
    }

    @Test
    void signXadesShouldReturnSignedXmlWhenValidRequest() throws Exception {
        // Arrange
        String xml = "<?xml version=\"1.0\"?><Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"><cbc:ID>F001-1</cbc:ID></Invoice>";
        String signedXml = xml.replace("</Invoice>", "<ext:UBLExtensions xmlns:ext=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\"><ext:UBLExtension><ext:ExtensionContent><ds:Signature xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\" Id=\"Id-Signature-1\">...</ds:Signature></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions></Invoice>");
        
        when(xadesSignerService.signUbl(anyString(), anyString(), anyString()))
                .thenReturn(signedXml);

        String requestJson = """
                {
                    "xml": "%s",
                    "p12Base64": "MIIC...",
                    "password": "test123"
                }
                """.formatted(xml.replace("\"", "\\\""));

        // Act & Assert
        mockMvc.perform(post("/sign-xades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signedXml").value(signedXml))
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    void signXadesShouldReturnBadRequestWhenXmlIsEmpty() throws Exception {
        String requestJson = """
                {
                    "xml": "",
                    "p12Base64": "MIIC...",
                    "password": "test123"
                }
                """;

        mockMvc.perform(post("/sign-xades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Petición inválida. Debe proporcionar 'xml' y ('p12Base64'+'password' o 'keyAlias')"))
                .andExpect(jsonPath("$.signedXml").doesNotExist());
    }

    @Test
    void signXadesShouldReturnBadRequestWhenP12Base64IsEmpty() throws Exception {
        String requestJson = """
                {
                    "xml": "<?xml version=\\"1.0\\"?><Invoice></Invoice>",
                    "p12Base64": "",
                    "password": "test123"
                }
                """;

        mockMvc.perform(post("/sign-xades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Petición inválida. Debe proporcionar 'xml' y ('p12Base64'+'password' o 'keyAlias')"))
                .andExpect(jsonPath("$.signedXml").doesNotExist());
    }

    @Test
    void signXadesShouldReturnBadRequestWhenPasswordIsNull() throws Exception {
        String requestJson = """
                {
                    "xml": "<?xml version=\\"1.0\\"?><Invoice></Invoice>",
                    "p12Base64": "MIIC...",
                    "password": null
                }
                """;

        mockMvc.perform(post("/sign-xades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Petición inválida. Debe proporcionar 'xml' y ('p12Base64'+'password' o 'keyAlias')"))
                .andExpect(jsonPath("$.signedXml").doesNotExist());
    }

    @Test
    void signXadesShouldReturnInternalServerErrorWhenServiceThrowsException() throws Exception {
        when(xadesSignerService.signUbl(anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Error interno"));

        String requestJson = """
                {
                    "xml": "<?xml version=\\"1.0\\"?><Invoice></Invoice>",
                    "p12Base64": "MIIC...",
                    "password": "test123"
                }
                """;

        mockMvc.perform(post("/sign-xades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Error interno al procesar la firma"))
                .andExpect(jsonPath("$.signedXml").doesNotExist());
    }

    @Test
    void signXadesShouldReturnSignedXmlWhenValidAliasRequest() throws Exception {
        // Arrange
        String xml = "<?xml version=\"1.0\"?><Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"><cbc:ID>F001-1</cbc:ID></Invoice>";
        String signedXml = xml.replace("</Invoice>", "<ext:UBLExtensions xmlns:ext=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\"><ext:UBLExtension><ext:ExtensionContent><ds:Signature xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\" Id=\"Id-Signature-1\">...</ds:Signature></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions></Invoice>");
        
        when(xadesSignerService.signUblWithAlias(anyString(), anyString()))
                .thenReturn(signedXml);

        String requestJson = """
                {
                    "xml": "%s",
                    "keyAlias": "test_cert"
                }
                """.formatted(xml.replace("\"", "\\\""));

        // Act & Assert
        mockMvc.perform(post("/sign-xades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signedXml").value(signedXml))
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    void signXadesShouldReturnBadRequestWhenNoValidMode() throws Exception {
        String requestJson = """
                {
                    "xml": "<?xml version=\\"1.0\\"?><Invoice></Invoice>"
                }
                """;

        mockMvc.perform(post("/sign-xades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Petición inválida. Debe proporcionar 'xml' y ('p12Base64'+'password' o 'keyAlias')"))
                .andExpect(jsonPath("$.signedXml").doesNotExist());
    }
}