// Packages a directory of static files (a self-contained HTML/JS/CSS app,
// same idea as a "web app") into a ZIM archive, so it can be added to
// zims/library.xml and served through kiwix-serve like any other book.
//
// Usage: dir2zim <src_dir> <out.zim> <main_page_relpath> <title> <language>

#include <zim/writer/creator.h>
#include <zim/writer/item.h>
#include <zim/zim.h>

#include <ctime>
#include <filesystem>
#include <iostream>
#include <map>
#include <memory>
#include <string>

namespace fs = std::filesystem;

// ZIM's "Date" metadata is the archive's build date, in YYYY-MM-DD (the
// format kiwix-serve's catalog expects to render a content date) - there
// is no meaningful "source content date" for these apps since we author
// them ourselves, so the packaging date is the correct value.
static std::string todayIso8601()
{
  const std::time_t now = std::time(nullptr);
  std::tm tmBuf{};
  gmtime_r(&now, &tmBuf);
  char buf[11];
  std::strftime(buf, sizeof(buf), "%Y-%m-%d", &tmBuf);
  return std::string(buf);
}

static std::string guessMimeType(const std::string& ext)
{
  static const std::map<std::string, std::string> types = {
      {".html", "text/html"},       {".htm", "text/html"},
      {".js", "text/javascript"},   {".mjs", "text/javascript"},
      {".css", "text/css"},         {".json", "application/json"},
      {".svg", "image/svg+xml"},    {".png", "image/png"},
      {".jpg", "image/jpeg"},       {".jpeg", "image/jpeg"},
      {".gif", "image/gif"},        {".webp", "image/webp"},
      {".woff", "font/woff"},       {".woff2", "font/woff2"},
      {".txt", "text/plain"},       {".ico", "image/x-icon"},
  };
  const auto it = types.find(ext);
  return it == types.end() ? "application/octet-stream" : it->second;
}

int main(int argc, char** argv)
{
  if (argc < 6) {
    std::cerr << "usage: dir2zim <src_dir> <out.zim> <main_page_relpath> <title> <language>\n";
    return 1;
  }
  const fs::path srcDir = argv[1];
  const std::string outZim = argv[2];
  const std::string mainPage = argv[3];
  const std::string title = argv[4];
  const std::string language = argv[5];

  zim::writer::Creator creator;
  creator.configCompression(zim::Compression::Zstd);
  creator.configIndexing(true, language);
  creator.startZimCreation(outZim);

  bool foundMainPage = false;
  for (const auto& entry : fs::recursive_directory_iterator(srcDir)) {
    if (!entry.is_regular_file()) continue;

    const std::string relPath = fs::relative(entry.path(), srcDir).generic_string();
    const std::string mime = guessMimeType(entry.path().extension().string());

    zim::writer::Hints hints;
    if (relPath == mainPage) {
      hints[zim::writer::FRONT_ARTICLE] = 1;
      foundMainPage = true;
    }

    auto item = std::make_shared<zim::writer::FileItem>(
        relPath, mime, relPath, hints, entry.path().string());
    creator.addItem(item);
    std::cout << "added " << relPath << " (" << mime << ")\n";
  }

  if (!foundMainPage) {
    std::cerr << "error: main page '" << mainPage << "' was not found under " << srcDir << "\n";
    return 1;
  }

  creator.setMainPath(mainPage);
  creator.addMetadata("Title", title);
  creator.addMetadata("Language", language);
  creator.addMetadata("Creator", "StashPi");
  creator.addMetadata("Publisher", "StashPi");
  creator.addMetadata("Description", title);
  creator.addMetadata("Name", title);
  creator.addMetadata("Date", todayIso8601());

  creator.finishZimCreation();
  std::cout << "done: " << outZim << "\n";
  return 0;
}
