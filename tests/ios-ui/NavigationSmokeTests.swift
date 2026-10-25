import XCTest
import UIKit

final class NavigationSmokeTests: XCTestCase {
  func testNativeTabsAndRotation() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    let labels = [
      ["Home", "Domov", "Inicio", "Accueil", "Strona główna"],
      ["History", "História", "Historie", "Verlauf", "Historial", "Historique", "Cronologia", "Historia"],
      ["Favorites", "Obľúbené", "Oblíbené", "Favoriten", "Favoritos", "Favoris", "Preferiti", "Ulubione"],
      ["Analytics", "Analýza", "Analyse", "Análisis", "Analisi", "Analiza"],
      ["Settings", "Nastavenia", "Nastavení", "Einstellungen", "Ajustes", "Réglages", "Paramètres", "Impostazioni", "Ustawienia"]
    ]
    func tab(_ index: Int) -> XCUIElement {
      app.buttons.matching(NSPredicate(format: "label IN %@", labels[index])).firstMatch
    }
    // iOS 27 exposes the vertical rail as toolbar buttons, not an AXTabBar.
    let home = tab(0)
    let history = tab(1)
    XCTAssertTrue(history.waitForExistence(timeout: 30), "System navigation must be visible")
    let bounds = app.windows.firstMatch.frame
    if bounds.width >= 840 && bounds.height >= 520 && bounds.width > bounds.height {
      XCTAssertFalse(home.exists, "Home is already pinned in the left pane")
    }
    func capture(_ name: String) {
      let attachment = XCTAttachment(screenshot: app.screenshot())
      attachment.name = name
      attachment.lifetime = .keepAlways
      add(attachment)
    }
    capture("01-home")
    for index in [1, 2, 3, 4] {
      let button = tab(index)
      XCTAssertTrue(button.isHittable)
      button.tap()
      // iPad's floating tab buttons do not expose the selected AX trait.
      // Preserve screenshots of each screen for visual verification there.
      if UIDevice.current.userInterfaceIdiom != .pad {
        let selected = NSPredicate(format: "selected == true")
        expectation(for: selected, evaluatedWith: button)
        waitForExpectations(timeout: 10)
      }
      XCTAssertEqual(app.state, .runningForeground)
      capture("02-tab-\(index)")
    }
    if home.exists { home.tap() } else { history.tap() }
    XCUIDevice.shared.orientation = .landscapeLeft
    XCTAssertTrue(history.waitForExistence(timeout: 10))
    capture("03-landscape")
    XCUIDevice.shared.orientation = .portrait
    capture("04-portrait")
    XCTAssertEqual(app.state, .runningForeground)
  }
}
